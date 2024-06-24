import { getServerSession } from 'next-auth/next'

import { headers } from 'next/headers'

import { options } from '../api/auth/[...nextauth]/options'

import RightSidebar from '@/components/Sidebar/RightSidebar'
import Sidebar from '@/components/Sidebar/Sidebar'

import { getFriendsDataList } from '@/lib/getFriendsData'

export default async function layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(options)
  const token = session?.user?.data.accessToken

  const headersList = headers()
  const headerPathname = headersList.get('x-pathname') || ''
  const isChatPage = headerPathname.includes('chat')
  const isTeamChatPage = headerPathname.includes('team')

  // 내 친구 리스트
  const friendsList = await getFriendsDataList()

  return (
    <main className="flex w-full h-[calc(100vh_-_100px)] overflow-hidden mx-auto my-0">
      <Sidebar />
      {children}
      <RightSidebar
        token={token}
        isChatPage={isChatPage}
        isTeamChatPage={isTeamChatPage}
        friendsList={friendsList ? friendsList : []}
      />
    </main>
  )
}
