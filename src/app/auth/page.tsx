'use client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { triggerHaptic } from '@/lib/haptics';
import { ShieldCheck } from 'lucide-react';

export default function AuthPage() {
  const auth = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    triggerHaptic('medium');
    const provider = new GoogleAuthProvider();
    try {
      if (auth) {
        const result: UserCredential = await signInWithPopup(auth, provider);
        console.log('User signed in: ', result.user);
        triggerHaptic('success');
        router.push('/');
      }
    } catch (error) {
      triggerHaptic('warning');
      console.error('Error during Google sign-in:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="p-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-200/80 dark:border-slate-800 w-full max-w-sm text-center space-y-4">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">InvoiceFlow</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Sign in to manage your operations securely.
          </p>
        </div>
        <Button 
          onClick={handleGoogleSignIn} 
          className="w-full h-12 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-all"
        >
          Sign In with Google
        </Button>
      </div>
    </div>
  );
}
