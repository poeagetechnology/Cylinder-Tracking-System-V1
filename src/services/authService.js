import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { auth, db } from './firebase'

// Check if system is initialized
export const isSystemInitialized = async () => {
  const settingsDoc = await getDoc(doc(db, 'settings', 'system'))
  return settingsDoc.exists() && settingsDoc.data()?.systemInitialized === true
}

// Initialize system (create super admin)
export const initializeSystem = async ({ name, email, password }) => {
  const userCred = await createUserWithEmailAndPassword(auth, email, password)
  const uid = userCred.user.uid

  await setDoc(doc(db, 'users', uid), {
    uid,
    name,
    email,
    role: 'superadmin',
    status: 'approved',
    createdAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
  })

  await setDoc(doc(db, 'settings', 'system'), {
    systemInitialized: true,
    createdAt: serverTimestamp(),
  })

  return userCred.user
}

// Register new user
export const registerUser = async ({ name, email, password }) => {
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password)
    const uid = userCred.user.uid

    await setDoc(doc(db, 'users', uid), {
      uid,
      name,
      email,
      role: 'user',
      status: 'pending',
      createdAt: serverTimestamp(),
      approvedAt: null,
    })

    return userCred.user
  } catch (error) {
    throw new Error(`Registration failed: ${error.message}`)
  }
}

// Login
export const loginUser = async (email, password) => {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password)
    const userDoc = await getDoc(doc(db, 'users', userCred.user.uid))

    if (!userDoc.exists()) {
      await signOut(auth)
      throw new Error('User profile not found. Please contact an administrator.')
    }

    const userData = userDoc.data()

    if (userData.status === 'pending') {
      await signOut(auth)
      throw new Error('Your account is pending approval. Please wait for an admin to approve your account.')
    }

    if (userData.status === 'rejected') {
      await signOut(auth)
      throw new Error('Your account has been rejected. Please contact an administrator.')
    }

    if (userData.status !== 'approved') {
      await signOut(auth)
      throw new Error('Your account is not active. Please contact an administrator.')
    }

    // Ensure role is set (default to 'user' if missing)
    if (!userData.role) {
      await updateDoc(doc(db, 'users', userCred.user.uid), { role: 'user' })
      userData.role = 'user'
    }

    return { user: userCred.user, userData }
  } catch (error) {
    throw new Error(error.message || 'Login failed. Please check your credentials.')
  }
}

// Logout
export const logoutUser = () => signOut(auth)

// Get user profile
export const getUserProfile = async (uid) => {
  const userDoc = await getDoc(doc(db, 'users', uid))
  return userDoc.exists() ? userDoc.data() : null
}

// Listen to auth state
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback)

// Get all users (realtime)
export const subscribeToUsers = (callback) => {
  const q = query(collection(db, 'users'))
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(users)
  }, (error) => {
    console.error('Error fetching users:', error)
    // Still call callback with empty array to prevent UI from breaking
    callback([])
  })
}

// Update user status
export const updateUserStatus = async (uid, status) => {
  try {
    const userRef = doc(db, 'users', uid)
    const update = { status }
    if (status === 'approved') {
      update.approvedAt = serverTimestamp()
    }
    await updateDoc(userRef, update)
    // Force a document refresh
    return await getDoc(userRef)
  } catch (error) {
    throw new Error(`Failed to update user status: ${error.message}`)
  }
}

// Update user role
export const updateUserRole = async (uid, role) => {
  try {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, { role })
    return await getDoc(userRef)
  } catch (error) {
    throw new Error(`Failed to update user role: ${error.message}`)
  }
}

// Create user directly (by admin/superadmin)
export const createUserDirectly = async ({ name, email, password, role = 'user' }) => {
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password)
    const uid = userCred.user.uid

    await setDoc(doc(db, 'users', uid), {
      uid,
      name,
      email,
      role,
      status: 'approved',
      createdAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
    })

    return userCred.user
  } catch (error) {
    throw new Error(`Failed to create user: ${error.message}`)
  }
}
