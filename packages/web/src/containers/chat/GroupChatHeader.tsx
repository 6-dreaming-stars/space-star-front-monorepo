'use client'

import Image from 'next/image'
import { useContext, useEffect, useRef, useState } from 'react'
import { Ellipsis, Phone } from 'lucide-react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getGameById } from '@/apis/getGame'
import {
  getGroupChatInfo,
  getTeamChatRoomsMember,
} from '@/apis/getGroupChatByClient'
import { GameType, GroupChatInfo } from '@/types/type'
import styles from './chat.module.css'
import { ModalContext } from '@/components/providers/modal-provider'

export default function GroupChatHeader({
  roomNumber,
  token,
  UUID,
}: {
  roomNumber: string
  token: string
  UUID: string
}) {
  const [roomInfo, setRoomInfo] = useState<GroupChatInfo>()
  const [gameInfo, setGameInfo] = useState<GameType>()
  const [memberInfo, setMemberInfo] = useState()
  const [isConnected, setIsConnected] = useState(false) // 보이스 연결 상태 관리

  const remoteAudioContainerRef = useRef<HTMLDivElement>(null)
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peerInfo, setPeerInfo] = useState<Map<string, RTCPeerConnection>>(new Map())
  const [otherKeyList, setOtherKeyList] = useState<string[]>([])
  const [myKey] = useState<string>(UUID)
  const stompClient = useRef<Client | null>(null)
  const config: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  }

  const { openModal } = useContext(ModalContext)

  useEffect(() => {
    const fetchData = async () => {
      const roomData = await getGroupChatInfo(roomNumber, token)
      const gameData = await getGameById(roomData.gameId)
      const memberData = await getTeamChatRoomsMember(roomNumber, token)

      setRoomInfo(roomData)
      if (gameData) {
        setGameInfo(gameData)
      }
      setMemberInfo(memberData)
    }

    fetchData()
  }, [roomNumber])

  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })
        setLocalStream(stream)
        console.log('Local stream set', stream)
      } catch (error) {
        console.error('Error accessing media devices.', error)
      }
    }

    getMedia()
  }, [])

  const onIceCandidate = (iceEvent: RTCPeerConnectionIceEvent, otherKey: string) => {
    if (iceEvent.candidate) {
      console.log(`Sending ICE candidate to ${otherKey}`, iceEvent.candidate)
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.publish({
          destination: `/pub/peer/iceCandidate/${otherKey}/${roomNumber}`,
          body: JSON.stringify({
            key: myKey,
            body: iceEvent.candidate,
          }),
        })
      }
    }
  }

  const onTrack = (trackEvent: RTCTrackEvent, otherKey: string) => {
    console.log(`Received remote track from ${otherKey}`, trackEvent.streams)
    const [stream] = trackEvent.streams
    let audio = remoteAudioRefs.current.get(otherKey)

    if (!audio) {
      audio = document.createElement('audio')
      audio.autoplay = true
      audio.controls = true
      audio.id = otherKey
      audio.srcObject = stream

      const track = document.createElement('track')
      track.kind = 'captions'
      track.srclang = 'en'
      track.label = 'English'
      track.default = true
      audio.appendChild(track)

      if (remoteAudioContainerRef.current) {
        remoteAudioContainerRef.current.appendChild(audio)
      }

      remoteAudioRefs.current.set(otherKey, audio)
      console.log(`Added remote audio for ${otherKey}`)
    }
  }

  const createPeerConnection = async (otherKey: string): Promise<RTCPeerConnection> => {
    console.log(`Creating peer connection for ${otherKey}`)
    const pc = new RTCPeerConnection(config)
    pc.addEventListener('icecandidate', (event) => {
      onIceCandidate(event, otherKey)
    })
    pc.addEventListener('track', (event) => {
      onTrack(event, otherKey)
    })
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
      })
      console.log('Local stream tracks added to peer connection')
    }
    return pc
  }

  const setLocalAndSendMessage = (pc: RTCPeerConnection, sessionDescription: RTCSessionDescriptionInit) => {
    pc.setLocalDescription(sessionDescription)
    console.log('Local description set and sent', sessionDescription)
  }

  const sendAnswer = (pc: RTCPeerConnection, otherKey: string) => {
    pc.createAnswer().then((answer) => {
      setLocalAndSendMessage(pc, answer)
      console.log(`Sending answer to ${otherKey}`, answer)
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.publish({
          destination: `/pub/peer/answer/${otherKey}/${roomNumber}`,
          body: JSON.stringify({
            key: myKey,
            body: answer,
          }),
        })
      }
    })
  }

  const connectSocket = async (): Promise<void> => {
    const socket = new SockJS('https://spacestars.kr/api/v1/wsvoice')
    stompClient.current = new Client({
      webSocketFactory: () => socket,
      debug: (str) => {
        console.log(str)
      },
      onConnect: async (frame) => {
        console.log(`Connected to server ${frame.headers.server}`)
        console.log('Connected to WebRTC server')

        stompClient.current?.subscribe(
          `/sub/peer/iceCandidate/${myKey}/${roomNumber}`,
          (message) => {
            console.log('Received ICE candidate message')
            const { key, body: candidate } = JSON.parse(message.body)
            const pc = peerInfo.get(key)
            if (pc) {
              console.log(`Adding ICE candidate for ${key}`, candidate)
              pc.addIceCandidate(
                new RTCIceCandidate({
                  candidate: candidate.candidate,
                  sdpMLineIndex: candidate.sdpMLineIndex,
                  sdpMid: candidate.sdpMid,
                }),
              )
            }
          },
        )

        stompClient.current?.subscribe(
          `/sub/peer/offer/${myKey}/${roomNumber}`,
          async (message) => {
            console.log('Received offer message')
            const { key, body: offer } = JSON.parse(message.body)
            const pc = await createPeerConnection(key)
            if (
              pc.signalingState === 'stable' ||
              pc.signalingState === 'have-local-offer'
            ) {
              await pc.setRemoteDescription(
                new RTCSessionDescription({
                  type: offer.type,
                  sdp: offer.sdp,
                }),
              )
              sendAnswer(pc, key)
              setPeerInfo(new Map(peerInfo.set(key, pc)))
            } else {
              console.warn(
                `Cannot set remote description in signaling state: ${pc.signalingState}`,
              )
            }
          },
        )

        stompClient.current?.subscribe(
          `/sub/peer/answer/${myKey}/${roomNumber}`,
          (message) => {
            console.log('Received answer message')
            const { key, body: answer } = JSON.parse(message.body)
            const pc = peerInfo.get(key)
            if (pc) {
              if (pc.signalingState === 'have-local-offer') {
                pc.setRemoteDescription(new RTCSessionDescription(answer))
                console.log(`Set remote description for ${key}`, answer)
              } else {
                console.warn(
                  `Cannot set remote description in signaling state: ${pc.signalingState}`,
                )
              }
            } else {
              console.warn(`PeerConnection for key ${key} not found`)
            }
          },
        )

        stompClient.current?.subscribe(`/sub/call/key/${roomNumber}`, () => {
          console.log('Received call key request')
          if (stompClient.current && stompClient.current.connected) {
            stompClient.current.publish({
              destination: `/pub/send/key/${roomNumber}`,
              body: JSON.stringify({ roomNumber, key: myKey }),
            })
          }
        })

        stompClient.current?.subscribe(`/sub/send/key/${roomNumber}`, async (message) => {
          console.log('Received send key message')
          const { key } = JSON.parse(message.body)
          if (myKey !== key && !otherKeyList.includes(key)) {
            setOtherKeyList((prev) => [...prev, key])
            const pc = await createPeerConnection(key)
            sendOffer(pc, key)
          }
        })

        // 모든 클라이언트에게 새로운 클라이언트의 참여를 알림
        if (stompClient.current && stompClient.current.connected) {
          stompClient.current.publish({
            destination: `/pub/peer/join/${roomNumber}`,
            body: JSON.stringify({
              key: myKey,
            }),
          })
        }
      },
    })

    stompClient.current.activate()
    setIsConnected(true)
  }

  const sendOffer = (pc: RTCPeerConnection, otherKey: string) => {
    pc.createOffer().then((offer) => {
      setLocalAndSendMessage(pc, offer)
      console.log(`Sending offer to ${otherKey}`, offer)
      if (stompClient.current && stompClient.current.connected) {
        stompClient.current.publish({
          destination: `/pub/peer/offer/${otherKey}/${roomNumber}`,
          body: JSON.stringify({
            key: myKey,
            body: offer,
          }),
        })
      }
    })
  }

  const startStreams = async () => {
    if (stompClient.current && stompClient.current.connected) {
      console.log('Publishing call key request')
      stompClient.current.publish({
        destination: `/pub/call/key/${roomNumber}`,
        body: JSON.stringify({ roomNumber, key: myKey }),  // 방 번호와 키를 메시지 본문에 포함
      })
      setTimeout(() => {
        otherKeyList.forEach(async (key) => {
          if (!peerInfo.has(key)) {
            const pc = await createPeerConnection(key)
            setPeerInfo((prev) => new Map(prev.set(key, pc)))
            sendOffer(pc, key)
          }
        })
      }, 1000)
    } else {
      console.error('STOMP client is not connected')
    }
  }

  const disconnect = async () => {
    peerInfo.forEach((pc) => {
      pc.close()
    })
    setPeerInfo(new Map())

    // STOMP 클라이언트를 비활성화합니다.
    if (stompClient.current) {
      stompClient.current.deactivate()
    }

    // 비디오 스트림을 중지합니다.
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    // 원격 오디오 요소를 제거합니다.
    remoteAudioRefs.current.forEach((audio) => {
      if (remoteAudioContainerRef.current) {
        remoteAudioContainerRef.current.removeChild(audio)
      }
    })
    remoteAudioRefs.current.clear()

    console.log('Disconnected from room')
    setIsConnected(false)
  }

  const handleCall = () => {
    if (isConnected) {
      disconnect()
    } else {
      connectSocket().then(() => {
        startStreams()
      })
    }
  }

  const handleMore = () => {
    openModal(<div className={styles.roomPopup}></div>)
  }

  return (
    <div className={styles.header}>
      {gameInfo && (
        <Image
          src={gameInfo.gameImage}
          alt={gameInfo.gameName}
          width={48}
          height={48}
          className={styles.image}
        />
      )}
      <div className={styles.roomInfo}>
        <h3>{roomInfo?.roomName ?? ''}</h3>
        <p>{roomInfo?.memo ?? ''}</p>
      </div>

      <div className="flex-1" />

      <div className={styles.icons}>
        <button type="button" onClick={handleCall}>
          <Phone stroke={isConnected ? 'red' : 'green'} />
        </button>

        <button type="button" onClick={handleMore}>
          <Ellipsis stroke="#869AA9" />
        </button>
      </div>

      <div ref={remoteAudioContainerRef} />
    </div>
  )
}
