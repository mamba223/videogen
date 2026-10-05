export interface CameraMotionOption {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  promptCues: {
    default: string;
    "wan-2.1"?: string;
    "ltx-video"?: string;
    "cogvideox"?: string;
    "hunyuan"?: string;
  };
}

export const CAMERA_MOTIONS: CameraMotionOption[] = [
  {
    id: "none",
    name: "Locked Off",
    icon: "🎬",
    tagline: "Static Tripod",
    description: "Stable, fixed camera position emphasizing natural motion in the scene.",
    promptCues: {
      default: "static camera, locked-off tripod shot, steady framing",
    },
  },
  {
    id: "zoom-in",
    name: "Push In",
    icon: "🔍",
    tagline: "Slow Dolly In",
    description: "Gradual cinematic push towards the focal subject for dramatic tension.",
    promptCues: {
      default: "cinematic slow push in, smooth forward dolly movement towards subject, focal emphasis",
      "wan-2.1": "smooth dolly zoom forward into the focal subject, shallow depth of field transition",
      "ltx-video": "camera moves forward slowly, push in shot, high stability",
      "cogvideox": "forward tracking camera motion, closing distance to character",
      "hunyuan": "volumetric forward camera push, slow cinematic dolly move",
    },
  },
  {
    id: "zoom-out",
    name: "Pull Out",
    icon: "🔭",
    tagline: "Dolly Back Reveal",
    description: "Pulls away to reveal vast surroundings, scale, and cinematic atmosphere.",
    promptCues: {
      default: "cinematic slow pull out, camera dollies backwards revealing surrounding environment, wide perspective",
      "wan-2.1": "pull back camera dolly, wide environmental reveal, grand cinematic scale",
      "ltx-video": "camera moves backwards slowly, pull out shot, wide framing reveal",
    },
  },
  {
    id: "pan-left",
    name: "Pan Left",
    icon: "⬅️",
    tagline: "Horizontal Sweep Left",
    description: "Smooth horizontal panning shot scanning across the scenery to the left.",
    promptCues: {
      default: "smooth horizontal camera pan left, cinematic sideways tracking shot",
      "wan-2.1": "continuous fluid camera pan to the left, sweeping architectural view",
      "ltx-video": "pan left camera motion, steady horizontal sweep",
    },
  },
  {
    id: "pan-right",
    name: "Pan Right",
    icon: "➡️",
    tagline: "Horizontal Sweep Right",
    description: "Smooth horizontal panning shot scanning across the scenery to the right.",
    promptCues: {
      default: "smooth horizontal camera pan right, cinematic sideways tracking shot",
      "wan-2.1": "continuous fluid camera pan to the right, sweeping cinematic view",
      "ltx-video": "pan right camera motion, steady horizontal sweep",
    },
  },
  {
    id: "tilt-up",
    name: "Tilt Up",
    icon: "⬆️",
    tagline: "Low to High Angle",
    description: "Upward camera tilt from ground level to reveal towering height, sky, or monoliths.",
    promptCues: {
      default: "vertical tilt up from low angle, revealing grand height, sky, and towering structure",
      "wan-2.1": "vertical camera pedestal move and tilt up, dramatic elevation shift",
    },
  },
  {
    id: "tilt-down",
    name: "Tilt Down",
    icon: "⬇️",
    tagline: "High to Low Crane",
    description: "Downward crane tilt from bird's-eye view focusing onto the subject below.",
    promptCues: {
      default: "high angle crane tilt down towards subject, descending perspective",
      "wan-2.1": "smooth crane descent, high angle tilt down, focal subject isolation",
    },
  },
  {
    id: "drone-orbit",
    name: "360 Orbit",
    icon: "🚁",
    tagline: "Drone Orbit Sweep",
    description: "Dynamic circular aerial orbit around the central subject with parallax background.",
    promptCues: {
      default: "aerial 360 degree rotational orbit around subject, cinematic drone camera, parallax landscape",
      "wan-2.1": "sweeping circular drone orbit around center point, smooth rotational parallax",
      "cogvideox": "curved orbital camera motion circling the subject, volumetric background shift",
    },
  },
  {
    id: "fpv-tracking",
    name: "Follow Cam",
    icon: "⚡",
    tagline: "Dynamic Tracking Shot",
    description: "Close-following energetic camera that moves synchronously with the character.",
    promptCues: {
      default: "dynamic handheld tracking shot, trailing closely behind subject, energetic motion",
      "wan-2.1": "steadicam tracking shot matching character momentum, realistic kinetic motion",
      "ltx-video": "fast tracking camera, forward momentum, stabilized follow shot",
    },
  },
];

/**
 * Injects model-optimized camera motion cues into a prompt.
 */
export function applyCameraMotion(prompt: string, motionId: string, modelId: string = "wan-2.1"): string {
  if (!motionId || motionId === "none") return prompt;
  const motion = CAMERA_MOTIONS.find((m) => m.id === motionId);
  if (!motion) return prompt;

  const cue = (motion.promptCues as Record<string, string>)[modelId] || motion.promptCues.default;
  const cleanPrompt = prompt.trim().replace(/\.\s*$/, "");

  // Avoid duplicate injection
  if (cleanPrompt.toLowerCase().includes(motion.name.toLowerCase())) {
    return cleanPrompt;
  }

  return `${cleanPrompt}. [Camera: ${cue}]`;
}
