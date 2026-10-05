/**
 * ReelForge Mobile API Client
 * Connects the React Native mobile client to the Supabase backend and ReelForge Next.js server.
 */

export interface MobileVideo {
  id: string;
  author: string;
  title?: string;
  prompt: string;
  videoUrl: string;
  clips: string[];
  likes: number;
  liked: boolean;
  commentsCount: number;
  seriesId?: string;
  episode?: number;
}

// Configurable endpoint (defaults to localhost:3000 during dev)
export const API_BASE_URL = "http://localhost:3000";

const SAMPLE_MOBILE_VIDEOS: MobileVideo[] = [
  {
    id: "demo-v1",
    author: "mara_writer",
    title: "The Door in the Cliffs",
    prompt: "Mara discovers a glowing door in the cliffs at dawn. Moody watercolor cinematic lighting.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    clips: [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    ],
    likes: 42,
    liked: false,
    commentsCount: 3,
    seriesId: "demo-s1",
    episode: 1,
  },
  {
    id: "demo-v2",
    author: "neo_cinema",
    title: "Neon Rain Samurai",
    prompt: "Cyberpunk samurai stands under holographic neon signs in Tokyo rain, reflection in puddle.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    clips: ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"],
    likes: 89,
    liked: true,
    commentsCount: 5,
  },
];

export async function fetchFeed(): Promise<MobileVideo[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/feed`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Return sample videos if offline or in dev without local network tunnel
  }
  return SAMPLE_MOBILE_VIDEOS;
}
