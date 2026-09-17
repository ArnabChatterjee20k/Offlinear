import { ID } from "appwrite";
import { ATTACH_BUCKET, appwriteConfigured, storage } from "@/sync/appwrite-config";

export interface Upload {
  url: string;
  name: string;
  isImage: boolean;
}

/** Upload a pasted/dropped/picked file to Appwrite Storage and return a URL.
 *  Falls back to an inline data URL for images when Appwrite isn't configured. */
export async function uploadAttachment(file: File): Promise<Upload> {
  const isImage = file.type.startsWith("image/");
  if (appwriteConfigured && storage) {
    const res = await storage.createFile(ATTACH_BUCKET, ID.unique(), file);
    const url = String(storage.getFileView(ATTACH_BUCKET, res.$id));
    return { url, name: file.name, isImage };
  }
  if (isImage) {
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    return { url, name: file.name, isImage };
  }
  throw new Error("Connect Appwrite to upload files.");
}
