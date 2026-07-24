import { useQuery } from '@tanstack/react-query'
import { fetchUserPins } from '../publicProfileApi'

export function useMyPins(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-pins', userId],
    queryFn: () => fetchUserPins(userId!),
    enabled: Boolean(userId),
  })
}
