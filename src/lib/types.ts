export interface Video {
  id: string;
  userId?: string;
  title?: string;
  prompt: string;
  videoUrl: string;
  /** Ordered scene clips; an episode plays these back to back. */
  clips: string[];
  seriesId?: string;
  episode?: number;
  visibility: "public" | "private";
  likes: number;
  liked: boolean;
  commentsCount?: number;
  createdAt: number;
  author?: string;
  isFollowingAuthor?: boolean;
  status?: "queued" | "generating" | "ready" | "failed";
  /** 0-100, share of scenes finished */
  progress?: number;
  error?: string;
  sceneCount?: number;
  narrations?: string[];
  audioUrls?: string[];
  audioTrackUrl?: string;
  audioTrackTitle?: string;
  model?: string;
  voiceId?: string;
}

export interface SceneInput {
  prompt: string;
  narration: string;
  durationSec?: 3 | 5 | 8;
  cameraMotion?: string;
  seed?: number;
}

export interface Series {
  id: string;
  userId?: string;
  title: string;
  bible: string;
  createdAt: number;
  episodeCount?: number;
}

export interface SeriesDetail extends Series {
  creatorUsername?: string;
  creatorId?: string;
  episodes: Video[];
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  username: string;
  body: string;
  createdAt: number;
}

export interface CreatorProfile {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  videos: Video[];
  series: Series[];
}

export type AssetKind = "script" | "document" | "image" | "audio";

export interface Asset {
  id: string;
  seriesId?: string;
  kind: AssetKind;
  name: string;
  url: string;
  text?: string;
  createdAt: number;
}

export interface User { id: string; email: string; username: string }
