'use client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const auth = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      if (auth) {
        const result: UserCredential = await signInWithPopup(auth, provider);
        console.log('User signed in: ', result.user);
        router.push('/');
      }
    } catch (error) {
      console.error('Error during Google sign-in:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to InvoiceFlow</h1>
        <p className="text-gray-600 mb-6">
          Sign in to manage your invoices securely.
        </p>
        <Button onClick={handleGoogleSignIn} className="w-full">
          Sign In with Google
        </Button>
      </div>
    </div>
  );
}
