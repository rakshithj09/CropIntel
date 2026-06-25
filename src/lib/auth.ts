'use client'

import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from './firebase'
import type { UserProfile } from './types'

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const auth = getFirebaseAuth()
  const db = getFirebaseDb()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName: name })
  await setDoc(doc(db, 'users', credential.user.uid), {
    name,
    email: credential.user.email ?? email,
    emailVerified: credential.user.emailVerified,
    createdAt: serverTimestamp(),
  })
  await sendEmailVerification(credential.user)
  return credential.user
}

export async function signInWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  await syncUserProfile(credential.user)
  return credential.user
}

export function getEmailSignInMethods(email: string) {
  return fetchSignInMethodsForEmail(getFirebaseAuth(), email)
}

export async function syncUserProfile(user: User) {
  const db = getFirebaseDb()
  const ref = doc(db, 'users', user.uid)
  const snapshot = await getDoc(ref)
  const payload = {
    name: user.displayName || user.email?.split('@')[0] || 'CropIntel user',
    email: user.email ?? '',
    emailVerified: user.emailVerified,
  }

  if (snapshot.exists()) {
    await updateDoc(ref, payload)
    return
  }

  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
  })
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = getFirebaseDb()
  const snapshot = await getDoc(doc(db, 'users', userId))
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as UserProfile
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email)
}

export function sendCurrentUserVerificationEmail() {
  const auth = getFirebaseAuth()
  if (!auth.currentUser) throw new Error('You must be signed in to send a verification email.')
  return sendEmailVerification(auth.currentUser)
}

export function signOutUser() {
  return signOut(getFirebaseAuth())
}
