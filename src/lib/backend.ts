import type { Asset, AssetKind, Comment, CreatorProfile, SceneInput, Series, SeriesDetail, User, Video } from "@/lib/types";

export type { SceneInput };

export interface NewEpisode {
  title?: string;
  prompt: string;
  seriesId?: string;
  episode?: number;
  visibility: "public" | "private";
  scenes: SceneInput[];
  /** Series bible + episode bible, prepended to every scene prompt by the worker */
  style?: string;
  /** Library image assets used as visual references */
  referenceAssetIds?: string[];
  sceneSeconds: 3 | 5 | 8;
  audioTrackUrl?: string;
  audioTrackTitle?: string;
  model?: string;
  voiceId?: string;
}

/** Everything the UI needs from a backend. Implemented by the Supabase backend and a volatile demo backend. */
export interface Backend {
  name: "cloud" | "demo";
  getUser(): Promise<User | null>;
  signIn(email: string, password: string): Promise<string | undefined>;
  signUp(email: string, password: string): Promise<string | undefined>;
  signOut(): Promise<void>;
  getCredits(): Promise<number>;
  listFeed(): Promise<Video[]>;
  listMine(): Promise<Video[]>;
  getEpisode(id: string): Promise<Video | null>;
  enqueueEpisode(ep: NewEpisode): Promise<string>;
  cancelEpisode(id: string): Promise<number>;
  setVisibility(id: string, visibility: "public" | "private"): Promise<void>;
  toggleLike(video: Video): Promise<void>;
  listSeries(): Promise<Series[]>;
  getSeriesDetail(seriesId: string): Promise<SeriesDetail | null>;
  createSeries(title: string, bible: string): Promise<string>;
  nextEpisode(seriesId: string): Promise<number>;
  listAssets(seriesId?: string): Promise<Asset[]>;
  addAsset(file: File, kind: AssetKind, seriesId?: string, text?: string): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;

  // Social & Community
  listComments(videoId: string): Promise<Comment[]>;
  addComment(videoId: string, body: string): Promise<Comment>;
  deleteComment(commentId: string): Promise<void>;
  toggleFollow(targetUserId: string): Promise<boolean>;
  getCreatorProfile(username: string): Promise<CreatorProfile | null>;
  reportVideo(videoId: string, reason: string): Promise<void>;
}
