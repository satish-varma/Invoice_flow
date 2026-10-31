import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function uploadStorageFile(dcNumber: string, file: File | Blob, folderName: string = 'newrelic-signed-dcs', prefix: string = 'signed_'): Promise<string> {
  if (!file) throw new Error('No file provided');

  // Create a unique filename to prevent overwrites
  const timestamp = Date.now();
  const rawName = (file as File).name || 'attachment.jpg';
  const fileExtension = rawName.split('.').pop() || 'jpg';
  const fileName = `${prefix}${timestamp}.${fileExtension}`;
  
  const storageRef = ref(storage, `${folderName}/${dcNumber}/${fileName}`);
  
  try {
    // Dynamic timeout: At least 60s, +5s per MB for large uploads up to 20MB
    const fileSize = file.size || 0;
    const timeoutMs = Math.max(60000, Math.ceil(fileSize / (1024 * 1024)) * 5000);

    const uploadPromise = uploadBytes(storageRef, file);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Upload timed out. Please check your internet connection or try again.')), timeoutMs);
    });

    const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error: any) {
    console.error('Error uploading file to Firebase Storage:', error);
    throw new Error(error.message || 'Failed to upload file');
  }
}

export async function deleteStorageFile(fileUrl: string): Promise<void> {
  if (!fileUrl) return;

  try {
    // Extract the full path from the Firebase Storage URL
    const decodedUrl = decodeURIComponent(fileUrl);
    // Find the part after /o/ and before ?alt=media
    const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
    if (!pathMatch || pathMatch.length < 2) {
      throw new Error('Invalid Firebase Storage URL');
    }
    
    const filePath = pathMatch[1];
    const storageRef = ref(storage, filePath);
    
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file from Firebase Storage:', error);
    throw new Error('Failed to delete file');
  }
}
