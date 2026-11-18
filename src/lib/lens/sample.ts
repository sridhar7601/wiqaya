/**
 * The demo clip for Wiqaya Lens (public/samples/lens-sample.mp4): where it comes from, its licence, and what the
 * lab measured for the same sample, so the app can show the estimate next to the real result.
 *
 * Which clip and why: participant 77 of VISEM, one of the 22 held-out participants (never used for tuning). It
 * was picked by a rule fixed before any held-out result was looked at: among held-out participants, the one whose
 * lab results (total motility, progressive motility, concentration) are closest to the dataset's medians. So it
 * is a typical sample, not the one the estimator does best on.
 *
 * Licence: the video is from VISEM-Tracking, CC BY 4.0: it may be shared and changed, also commercially, with
 * credit. The lab values are from VISEM's semen_analysis_data.csv, published on Zenodo under CC BY-NC 4.0, and
 * Simula's terms say research and education only. Using them in a commercial product needs written permission
 * from Simula (contact on https://datasets.simula.no/visem/).
 */

export const LENS_SAMPLE = {
  src: 'samples/lens-sample.mp4',
  participant: 77,
  /** What is in the file: the first 10 s of VISEM-Tracking's 77_0_30.mp4, every second frame, re-encoded. */
  seconds: 10,
  fps: 25,
  width: 640,
  height: 480,
  /** The lab's semen analysis of this sample (WHO method, whole sample, assessed from the full video). */
  lab: { motile: 79, progressive: 42, nonProgressive: 37, immotile: 21, concentrationMPerMl: 82.4 },
  /**
   * What estimateMotility gives for this file in Node (ffmpeg decode, every frame, 320 x 240 area scaling).
   * A browser decode and canvas scaling may differ by a point or so.
   */
  nodeEstimate: { ok: true, motile: 74.3, progressive: 46.3, nonProgressive: 28, immotile: 25.7, cellsPerFrame: 116.8, rawMotile: 47.3, rawProgressive: 43.6 },
  credit: {
    en: 'Sample video: VISEM-Tracking (Thambawita et al., Scientific Data 2023), Simula/OsloMet, CC BY 4.0, re-encoded. Lab values: VISEM (Haugen et al., ACM MMSys 2019), CC BY-NC 4.0.',
    ar: 'فيديو العينة: VISEM-Tracking (Thambawita وآخرون، Scientific Data 2023)، Simula/OsloMet، رخصة CC BY 4.0، مع إعادة الترميز. قيم المختبر: VISEM (Haugen وآخرون، ACM MMSys 2019)، رخصة CC BY-NC 4.0.',
  },
  attribution: {
    video: {
      title: 'VISEM-Tracking, a human spermatozoa tracking dataset',
      authors: 'Vajira Thambawita, Steven A. Hicks, Andrea M. Storås, Thu Nguyen, Jorunn M. Andersen, Oliwia Witczak, Trine B. Haugen, Hugo L. Hammer, Pål Halvorsen, Michael A. Riegler',
      source: 'Scientific Data 10, 260 (2023), doi:10.1038/s41597-023-02173-4',
      url: 'https://zenodo.org/records/7293726',
      licence: 'CC BY 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
      file: 'visem-extracted-30s-excluding-selected-20/77_0_30.mp4',
      changes: 'Cut to the first 10 s, every second frame kept (25 frames per second), re-encoded as H.264 (yuv420p) without audio. Nothing else changed.',
    },
    lab: {
      title: 'VISEM: a multimodal video dataset of human spermatozoa',
      authors: 'Trine B. Haugen, Steven A. Hicks, Jorunn M. Andersen, Oliwia Witczak, Hugo L. Hammer, Rune Borgli, Pål Halvorsen, Michael Riegler',
      source: 'Proceedings of the 10th ACM Multimedia Systems Conference (MMSys 2019), 261-266, doi:10.1145/3304109.3325814',
      url: 'https://zenodo.org/records/2640506',
      licence: 'CC BY-NC 4.0 (Zenodo); research and education only per https://datasets.simula.no/visem/',
      licenceUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    },
  },
} as const
