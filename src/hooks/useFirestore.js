import { useState, useEffect } from 'react'
import { subscribeToCollection } from '../services/firestoreService'

export const useFirestoreCollection = (collectionName, constraints = []) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeToCollection(
      collectionName,
      (docs) => {
        setData(docs)
        setLoading(false)
      },
      constraints
    )
    return () => {
      unsub()
      setLoading(false)
    }
  }, [collectionName])

  return { data, loading, error }
}
