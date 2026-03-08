import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
const SAME_FACE_THRESHOLD = 0.52;
const MIN_SAME_FACE_RATIO = 0.55;
const VIDEOS_TO_CHECK = 5;       // videos per creator
const SCORE_THRESHOLD = 0.45;

let modelsLoaded = false;

export async function loadFaceModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

function euclidean(a, b) {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
    img.src = url;
  });
}

async function getDescriptorFromUrl(url) {
  try {
    const img = await loadImg(url);
    const result = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: SCORE_THRESHOLD }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    return result ? Array.from(result.descriptor) : null;
  } catch {
    return null;
  }
}

// For each video: check custom thumbnail + 3 actual video frames (25%, 50%, 75%)
// All 4 images loaded in parallel
async function getDescriptorsForVideo(videoId) {
  const urls = [
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, // custom thumbnail
    `https://i.ytimg.com/vi/${videoId}/1.jpg`,          // frame ~25%
    `https://i.ytimg.com/vi/${videoId}/2.jpg`,          // frame ~50%
    `https://i.ytimg.com/vi/${videoId}/3.jpg`,          // frame ~75%
  ];
  const results = await Promise.all(urls.map(getDescriptorFromUrl));
  return results.filter(Boolean);
}

export async function detectFaceConsistency(videoIds) {
  if (!videoIds || videoIds.length === 0) {
    return { has_face: false, same_face: false, face_count: 0, face_label: 'No face' };
  }

  const sample = videoIds.slice(0, VIDEOS_TO_CHECK);

  // All videos processed in parallel — ~5x faster than sequential
  const perVideo = await Promise.all(sample.map(getDescriptorsForVideo));
  const descriptors = perVideo.flat();

  if (descriptors.length === 0) {
    return { has_face: false, same_face: false, face_count: 0, face_label: 'No face' };
  }

  if (descriptors.length === 1) {
    return { has_face: true, same_face: true, face_count: 1, face_label: 'Same face' };
  }

  // Reference = descriptor closest to the centroid (most representative face)
  const mean = descriptors[0].map((_, i) =>
    descriptors.reduce((s, d) => s + d[i], 0) / descriptors.length
  );
  const ref = descriptors.reduce((best, d) =>
    euclidean(d, mean) < euclidean(best, mean) ? d : best
  , descriptors[0]);

  const matches = descriptors.filter(d => euclidean(d, ref) < SAME_FACE_THRESHOLD);
  const ratio = matches.length / descriptors.length;
  const sameFace = ratio >= MIN_SAME_FACE_RATIO;

  return {
    has_face: true,
    same_face: sameFace,
    face_count: descriptors.length,
    face_ratio: Math.round(ratio * 100),
    face_label: sameFace ? 'Same face' : 'Mixed',
  };
}

export async function detectFacesForAll(creators, onProgress) {
  await loadFaceModels();

  for (let i = 0; i < creators.length; i++) {
    const c = creators[i];
    const videoIds = c.api?.video_ids || [];
    try {
      c.api.face = await detectFaceConsistency(videoIds);
    } catch {
      c.api.face = { has_face: false, same_face: false, face_count: 0, face_label: 'Error' };
    }
    if (onProgress) onProgress(i + 1, creators.length, c.name);
  }

  return creators;
}
