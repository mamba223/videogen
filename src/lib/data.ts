import { supabaseConfigured } from "@/lib/supabase";
import { cloud } from "@/lib/cloud";
import { demo } from "@/lib/demo";
import type { Backend } from "@/lib/backend";

export type { Asset, AssetKind, Comment, CreatorProfile, Series, SeriesDetail, User, Video, SceneInput } from "@/lib/types";

/**
 * Supabase is the only real backend. The volatile in-memory demo backend exists for local
 * development without keys and is compiled out of production: a production build without
 * Supabase env vars shows a configuration error instead of silently storing data in the browser.
 */
export const isCloud = supabaseConfigured;
export const isDemo = !supabaseConfigured && process.env.NODE_ENV !== "production";
export const configMissing = !supabaseConfigured && !isDemo;

const b: Backend = isCloud ? cloud : demo;
const guard = <T,>(fn: () => Promise<T>): Promise<T> =>
  configMissing ? Promise.reject(new Error("Backend not configured")) : fn();

export const getUser = () => guard(() => b.getUser());
export const signIn = (e: string, p: string) => guard(() => b.signIn(e, p));
export const signUp = (e: string, p: string) => guard(() => b.signUp(e, p));
export const signOut = () => guard(() => b.signOut());
export const getCredits = () => guard(() => b.getCredits());
export const listFeed = () => guard(() => b.listFeed());
export const listMine = () => guard(() => b.listMine());
export const getEpisode: Backend["getEpisode"] = (id) => guard(() => b.getEpisode(id));
export const enqueueEpisode: Backend["enqueueEpisode"] = (ep) => guard(() => b.enqueueEpisode(ep));
export const cancelEpisode: Backend["cancelEpisode"] = (id) => guard(() => b.cancelEpisode(id));
export const setVisibility: Backend["setVisibility"] = (...a) => guard(() => b.setVisibility(...a));
export const toggleLike: Backend["toggleLike"] = (v) => guard(() => b.toggleLike(v));
export const listSeries = () => guard(() => b.listSeries());
export const getSeriesDetail: Backend["getSeriesDetail"] = (id) => guard(() => b.getSeriesDetail(id));
export const createSeries: Backend["createSeries"] = (...a) => guard(() => b.createSeries(...a));
export const nextEpisode: Backend["nextEpisode"] = (id) => guard(() => b.nextEpisode(id));
export const listAssets: Backend["listAssets"] = (id) => guard(() => b.listAssets(id));
export const addAsset: Backend["addAsset"] = (...a) => guard(() => b.addAsset(...a));
export const deleteAsset: Backend["deleteAsset"] = (id) => guard(() => b.deleteAsset(id));

// Social & Community
export const listComments: Backend["listComments"] = (vid) => guard(() => b.listComments(vid));
export const addComment: Backend["addComment"] = (vid, body) => guard(() => b.addComment(vid, body));
export const deleteComment: Backend["deleteComment"] = (cid) => guard(() => b.deleteComment(cid));
export const toggleFollow: Backend["toggleFollow"] = (uid) => guard(() => b.toggleFollow(uid));
export const getCreatorProfile: Backend["getCreatorProfile"] = (username) => guard(() => b.getCreatorProfile(username));
export const reportVideo: Backend["reportVideo"] = (vid, reason) => guard(() => b.reportVideo(vid, reason));
