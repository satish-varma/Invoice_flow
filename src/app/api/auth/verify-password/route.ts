import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashPassword } from '@/lib/hash';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
    }

    const email = session.user.email.toLowerCase().trim();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ success: false, error: 'User record not found' }, { status: 404 });
    }

    const userData = snapshot.docs[0].data();
    const inputHash = hashPassword(password);

    if (userData.password !== inputHash) {
      return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: 'Password verified successfully' });
  } catch (err: any) {
    console.error('Verify financial access error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server verification failed' }, { status: 500 });
  }
}
