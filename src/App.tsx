import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Plus, Music, Search, Tv, Users, Home, MessageSquare, User, Sparkles, LogIn, LogOut, Bell, Download, Grid, Lock, Video, Coins, Camera, ArrowUpRight, Play, Link, Database, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AIAssistant } from './components/AIAssistant';
import { 
  auth, db, googleProvider, facebookProvider, appleProvider, signInWithPopup, onAuthStateChanged, 
  collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, 
  addDoc, serverTimestamp, updateDoc, increment, deleteDoc, limit, orderBy,
  RecaptchaVerifier, signInWithPhoneNumber, User as FirebaseUser,
  ref, uploadBytesResumable, getDownloadURL, handleFirestoreError, OperationType, storage
} from './firebase';
import { Facebook, Phone, Mail, Apple } from 'lucide-react';

interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: any;
}

interface VideoData {
  id: string;
  url: string;
  user: string;
  userPhoto?: string;
  description: string;
  likes: number;
  comments: number;
  bookmarks: number;
  shares: number;
  music: string;
  effect?: string;
  filter?: string;
  authorId?: string;
}

interface CommentData {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: any;
  likes: number;
  likedBy?: string[];
}

const MOCK_VIDEOS: VideoData[] = [
  {
    id: '0',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-man-dancing-under-a-street-light-1240-large.mp4',
    user: 'MarketingPro',
    description: 'Presta atención y mira a los ojos. Vamos a hacer un trato. Yo te enseño a crear publicaciones para tus redes sociales o para las de tu negocio, de manera automática. 🚀📈 #Marketing #Automatizacion #Negocios',
    likes: 85000,
    comments: 4200,
    bookmarks: 15000,
    shares: 9100,
    music: 'Success Mindset - Business Beats',
  },
  {
    id: '1',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-dancing-9730-large.mp4',
    user: 'Cu3rvoN3gro',
    description: 'Escribe "ACTIVO MI META" ahora mismo. ✨🐦 #Meta15Dias #Abundancia #Exito',
    likes: 6200,
    comments: 1000,
    bookmarks: 2400,
    shares: 1400,
    music: 'Lunar Serenade - JM Music',
    effect: 'Black Baby'
  },
  {
    id: '2',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4',
    user: 'NatureVibes',
    description: 'Disfrutando de la primavera 🌸 #nature #relax #peace',
    likes: 12000,
    comments: 450,
    bookmarks: 1200,
    shares: 800,
    music: 'Birds in the Forest - Nature Sounds',
  },
  {
    id: '3',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-man-dancing-under-a-street-light-1240-large.mp4',
    user: 'DanceMaster',
    description: 'Noche de baile en la ciudad 🕺🔥 #dance #streetstyle #vibes',
    likes: 45000,
    comments: 2300,
    bookmarks: 10000,
    shares: 5600,
    music: 'Street Beats - DJ Urban',
  }
];

const VideoCard = React.memo(({ video, isActive, setShowToast, onLike, currentUser }: { 
  video: VideoData; 
  isActive: boolean; 
  setShowToast: (msg: string | null) => void;
  onLike?: (description: string) => void;
  currentUser: FirebaseUser | null;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHeart, setShowHeart] = useState<{ x: number; y: number; id: number } | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastTap = useRef<number>(0);
  const tapTimer = useRef<NodeJS.Timeout | null>(null);

  // Smooth loading effect
  const handleVideoLoad = () => {
    setIsLoading(false);
  };

  // Fetch comments in real-time
  useEffect(() => {
    if (isCommentsOpen) {
      setIsCommentsLoading(true);
      const q = query(
        collection(db, `videos/${video.id}/comments`),
        where('videoId', '==', video.id)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedComments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CommentData[];
        setComments(fetchedComments.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
        setIsCommentsLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `videos/${video.id}/comments`);
        setIsCommentsLoading(false);
      });
      return () => unsubscribe();
    }
  }, [isCommentsOpen, video.id]);

  // Check if user liked the video
  useEffect(() => {
    if (currentUser) {
      const checkLike = async () => {
        const likeDoc = await getDoc(doc(db, 'likes', `${currentUser.uid}_${video.id}`));
        setIsLiked(likeDoc.exists());
      };
      const checkFollow = async () => {
        if (video.authorId) {
          const followDoc = await getDoc(doc(db, 'follows', `${currentUser.uid}_${video.authorId}`));
          setIsFollowing(followDoc.exists());
        }
      };
      checkLike();
      checkFollow();
    }
  }, [currentUser, video.id, video.authorId]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      setShowToast('Inicia sesión para seguir');
      return;
    }
    if (!video.authorId || video.authorId === currentUser.uid) return;

    const followId = `${currentUser.uid}_${video.authorId}`;
    const followRef = doc(db, 'follows', followId);

    try {
      if (isFollowing) {
        await deleteDoc(followRef);
        await updateDoc(doc(db, 'users', currentUser.uid), { followingCount: increment(-1) });
        await updateDoc(doc(db, 'users', video.authorId), { followersCount: increment(-1) });
        setIsFollowing(false);
      } else {
        await setDoc(followRef, {
          followerId: currentUser.uid,
          followingId: video.authorId,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'users', currentUser.uid), { followingCount: increment(1) });
        await updateDoc(doc(db, 'users', video.authorId), { followersCount: increment(1) });
        setIsFollowing(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'follows');
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      setShowToast('Debes iniciar sesión para dar like');
      return;
    }

    const likeId = `${currentUser.uid}_${video.id}`;
    const likeRef = doc(db, 'likes', likeId);
    const videoRefDoc = doc(db, 'videos', video.id);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(videoRefDoc, { likes: increment(-1) });
        setIsLiked(false);
      } else {
        await setDoc(likeRef, {
          userId: currentUser.uid,
          videoId: video.id,
          createdAt: serverTimestamp()
        });
        await updateDoc(videoRefDoc, { likes: increment(1) });
        setIsLiked(true);
        onLike?.(video.description);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'likes/videos');
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setShowToast('Preparando descarga... ⏳');
      const response = await fetch(video.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `kwai2_video_${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      setShowToast('¡Descarga completada! 📥');
    } catch (error) {
      console.error('Error downloading video:', error);
      setShowToast('Error al descargar el video ❌');
    }
  };

  const handleAddComment = async () => {
    if (!currentUser) {
      setShowToast('Debes iniciar sesión para comentar');
      return;
    }
    if (!newComment.trim()) return;

    try {
      await addDoc(collection(db, `videos/${video.id}/comments`), {
        videoId: video.id,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Usuario',
        userPhoto: currentUser.photoURL || '',
        text: newComment,
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: []
      });
      await updateDoc(doc(db, 'videos', video.id), { comments: increment(1) });
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `videos/${video.id}/comments`);
    }
  };

  const handleLikeComment = async (commentId: string, currentLikes: number, likedBy: string[] = []) => {
    if (!currentUser) {
      setShowToast('Inicia sesión para dar like');
      return;
    }

    const isAlreadyLiked = likedBy.includes(currentUser.uid);
    const commentRef = doc(db, `videos/${video.id}/comments`, commentId);

    try {
      if (isAlreadyLiked) {
        await updateDoc(commentRef, {
          likes: increment(-1),
          likedBy: likedBy.filter(id => id !== currentUser.uid)
        });
      } else {
        await updateDoc(commentRef, {
          likes: increment(1),
          likedBy: [...likedBy, currentUser.uid]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `videos/${video.id}/comments/${commentId}`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('¿Eliminar este comentario?')) return;
    
    try {
      await deleteDoc(doc(db, `videos/${video.id}/comments`, commentId));
      await updateDoc(doc(db, 'videos', video.id), { comments: increment(-1) });
      setShowToast('Comentario eliminado');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `videos/${video.id}/comments/${commentId}`);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Ahora';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (!isLiked) {
        handleLike();
      }
      
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      setShowHeart({ x: clientX, y: clientY, id: Date.now() });
      setTimeout(() => setShowHeart(null), 1000);
      lastTap.current = 0;
    } else {
      // Potential single tap
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
          } else {
            videoRef.current.play().catch(() => {});
          }
          setIsPlaying(!isPlaying);
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const renderDescription = (text: string) => {
    return text.split(/(\s+)/).map((part, i) => {
      if (part.startsWith('@') || part.startsWith('#')) {
        return <span key={i} className="font-bold hover:underline cursor-pointer text-white">{part}</span>;
      }
      return part;
    });
  };

  const handleShare = async (platform?: string) => {
    const shareData = {
      title: `Mira este video de @${video.user} en Kwai 2`,
      text: video.description,
      url: window.location.href,
    };

    if (!platform && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        console.log('Error sharing:', err);
      }
    }

    // Fallback or specific platform sharing
    let shareUrl = '';
    const encodedUrl = encodeURIComponent(window.location.href);
    const encodedText = encodeURIComponent(`${shareData.title}\n\n${shareData.text}`);

    switch (platform) {
      case 'WhatsApp':
        shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'Facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'X':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'Telegram':
        shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'Messenger':
        shareUrl = `fb-messenger://share/?link=${encodedUrl}`;
        break;
      case 'Enlace':
        navigator.clipboard.writeText(window.location.href);
        setShowToast('Enlace copiado al portapapeles 📋');
        setIsShareOpen(false);
        return;
      case 'Descargar':
        handleDownload(new MouseEvent('click') as any);
        setIsShareOpen(false);
        return;
      default:
        if (navigator.share) {
          navigator.share(shareData);
        }
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
    setIsShareOpen(false);
  };

  return (
    <div 
      className="relative h-full w-full bg-black snap-start overflow-hidden"
      onClick={handleTap}
    >
      {/* Video Background */}
      <video
        ref={videoRef}
        src={video.url}
        onLoadedData={handleVideoLoad}
        className={`h-full w-full object-cover transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-1'}`}
        style={{ filter: video.filter || 'none' }}
        loop
        muted
        playsInline
      />

      {/* Loading Skeleton */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-900 flex items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-white/40 text-xs font-bold tracking-widest uppercase">Cargando...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play/Pause Indicator */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div 
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 2 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <div className="bg-black/20 p-4 rounded-full backdrop-blur-sm">
              <Plus className="w-12 h-12 text-white/80 rotate-45" style={{ transform: 'rotate(45deg)' }} />
              {/* Using Plus rotated as a play icon placeholder or just a custom shape */}
              <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white/80 border-b-[15px] border-b-transparent ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Heart Animation */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            key={showHeart.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1.2], opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{ 
              position: 'fixed', 
              left: showHeart.x - 40, 
              top: showHeart.y - 40, 
              zIndex: 50,
              pointerEvents: 'none'
            }}
          >
            <Heart className="w-20 h-20 text-[#FE2C55] fill-[#FE2C55] drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {/* Right Sidebar Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center space-y-6 z-10">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-gray-800">
            <img 
              src={video.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.user}`} 
              alt="avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          {video.authorId !== currentUser?.uid && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1 }}
              onClick={handleFollow}
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full p-0.5 transition-colors ${isFollowing ? 'bg-gray-400' : 'bg-[#FE2C55]'}`}
            >
              {isFollowing ? (
                <Users className="w-3 h-3 text-white" />
              ) : (
                <Plus className="w-4 h-4 text-white" />
              )}
            </motion.button>
          )}
        </div>

        <motion.button 
          whileTap={{ scale: 0.8 }}
          whileHover={{ scale: 1.2 }}
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }} 
          className="flex flex-col items-center group"
        >
          <motion.div animate={{ scale: isLiked ? [1, 1.2, 1] : 1 }}>
            <Heart className={`w-8 h-8 ${isLiked ? 'fill-[#FE2C55] text-[#FE2C55]' : 'text-white'}`} />
          </motion.div>
          <span className="text-white text-xs font-semibold mt-1">{video.likes}</span>
        </motion.button>

        <motion.button 
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.1 }}
          onClick={(e) => {
            e.stopPropagation();
            setIsCommentsOpen(true);
          }}
          className="flex flex-col items-center"
        >
          <MessageCircle className="w-8 h-8 text-white fill-white/10" />
          <span className="text-white text-xs font-semibold mt-1">{video.comments}</span>
        </motion.button>

        <div className="flex flex-col items-center">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsBookmarked(!isBookmarked);
            }}
            className="flex flex-col items-center"
          >
            <Bookmark className={`w-8 h-8 ${isBookmarked ? 'fill-yellow-400 text-yellow-400' : 'text-white fill-white/10'}`} />
            <span className="text-white text-xs font-semibold mt-1">{video.bookmarks}</span>
          </motion.button>
        </div>

        <div className="flex flex-col items-center">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsShareOpen(true);
            }}
            className="flex flex-col items-center"
          >
            <Share2 className="w-8 h-8 text-white fill-white/10" />
            <span className="text-white text-xs font-semibold mt-1">{video.shares}</span>
          </motion.button>
        </div>

        <div className="flex flex-col items-center">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={handleDownload}
            className="flex flex-col items-center group transition-transform"
          >
            <Download className="w-8 h-8 text-white fill-white/10" />
            <span className="text-white text-[10px] font-semibold mt-1">Bajar</span>
          </motion.button>
        </div>

        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 rounded-full border-8 border-gray-800/80 bg-black flex items-center justify-center overflow-hidden"
        >
          <img 
            src={`https://api.dicebear.com/7.x/identicon/svg?seed=${video.music}`} 
            alt="music" 
            className="w-6 h-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>

      {/* Bottom Info */}
      <div className="absolute left-4 bottom-24 right-20 z-10">
        {video.effect && (
          <div className="bg-black/20 backdrop-blur-md px-2 py-1 rounded inline-flex items-center space-x-1 mb-3">
            <div className="w-4 h-4 bg-yellow-400 rounded-sm flex items-center justify-center">
              <span className="text-[10px] font-bold text-black">✨</span>
            </div>
            <span className="text-white text-xs font-medium">Efecto · {video.effect}</span>
          </div>
        )}
        
        <h3 className="text-white font-bold text-base mb-2">@{video.user}</h3>
        <p className="text-white text-sm mb-3 line-clamp-2 leading-tight">
          {renderDescription(video.description)}
        </p>
        
        <div className="flex items-center space-x-2">
          <Music className="w-3 h-3 text-white" />
          <div className="overflow-hidden w-40">
            <motion.p 
              animate={{ x: [0, -100] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="text-white text-xs whitespace-nowrap"
            >
              {video.music} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {video.music}
            </motion.p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-[72px] left-0 right-0 h-0.5 bg-white/20">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: isActive ? "100%" : 0 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="h-full bg-white/60"
        />
      </div>

      {/* Share Panel */}
      <AnimatePresence>
        {isShareOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsShareOpen(false);
              }}
              className="absolute inset-0 bg-black/40 z-40"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl z-50 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-center font-bold mb-6 text-white">Compartir en redes sociales</h4>
              <div className="grid grid-cols-4 gap-y-6 mb-8">
                {[
                  { name: 'WhatsApp', color: 'bg-[#25D366]' },
                  { name: 'Facebook', color: 'bg-[#1877F2]' },
                  { name: 'Instagram', color: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]' },
                  { name: 'X', color: 'bg-black border border-white/10' },
                  { name: 'Telegram', color: 'bg-[#0088cc]' },
                  { name: 'Messenger', color: 'bg-[#006AFF]' },
                  { name: 'Snapchat', color: 'bg-[#FFFC00]' },
                  { name: 'Enlace', color: 'bg-white/10' },
                  { name: 'Descargar', color: 'bg-white/10' }
                ].map((platform) => (
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    key={platform.name} 
                    onClick={() => handleShare(platform.name)}
                    className="flex flex-col items-center space-y-2 transition-transform"
                  >
                    <div className={`w-12 h-12 ${platform.color} rounded-full flex items-center justify-center shadow-md`}>
                      {platform.name === 'Enlace' ? (
                        <Link className="w-6 h-6 text-white" />
                      ) : platform.name === 'Descargar' ? (
                        <Download className="w-6 h-6 text-white" />
                      ) : (
                        <Share2 className={`w-6 h-6 ${platform.name === 'Snapchat' ? 'text-black' : 'text-white'}`} />
                      )}
                    </div>
                    <span className="text-[10px] text-white/60 font-medium">{platform.name}</span>
                  </motion.button>
                ))}
              </div>
              
              <div className="flex space-x-2 mb-6">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleShare()}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white flex items-center justify-center space-x-2 hover:bg-white/10 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Más opciones</span>
                </motion.button>
              </div>

              <motion.button 
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setIsShareOpen(false)}
                className="w-full py-3 text-white/40 font-medium hover:text-white transition-colors"
              >
                Cancelar
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCommentsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsCommentsOpen(false);
              }}
              className="absolute inset-0 bg-black/40 z-40"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 h-[70%] bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl z-50 flex flex-col"
            >
              <div className="relative p-4 border-b border-white/10">
                <h4 className="text-center text-xs font-bold text-white">{video.comments} comentarios</h4>
                <button 
                  onClick={() => setIsCommentsOpen(false)}
                  className="absolute right-4 top-4 text-white/40 hover:text-white transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {isCommentsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-[#FE2C55] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/20">
                    <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">Sé el primero en comentar</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3 group">
                      <img 
                        src={comment.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} 
                        className="w-8 h-8 rounded-full bg-white/5"
                        alt="user"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white/40">{comment.userName}</p>
                          {currentUser?.uid === comment.userId && (
                            <button 
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-[10px] text-red-500/60 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-white/90">{comment.text}</p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-[10px] text-white/20">{formatTime(comment.createdAt)}</span>
                          <motion.span 
                            whileTap={{ scale: 0.95 }}
                            className="text-[10px] font-bold text-white/40 cursor-pointer hover:text-white transition-colors"
                          >
                            Responder
                          </motion.span>
                        </div>
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.8 }}
                        whileHover={{ scale: 1.2 }}
                        onClick={() => handleLikeComment(comment.id, comment.likes, comment.likedBy)}
                        className="flex flex-col items-center group"
                      >
                        <Heart 
                          className={`w-4 h-4 transition-colors ${
                            comment.likedBy?.includes(currentUser?.uid || '') 
                              ? 'fill-[#FE2C55] text-[#FE2C55]' 
                              : 'text-white/20 group-hover:text-white/40'
                          }`} 
                        />
                        <span className="text-[10px] text-white/20">{comment.likes || 0}</span>
                      </motion.button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-white/10 flex items-center space-x-3 bg-[#121212] pb-8">
                <img 
                  src={currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=me`} 
                  className="w-8 h-8 rounded-full bg-white/5"
                  alt="me"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 flex items-center">
                  <input 
                    type="text" 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Añadir comentario..." 
                    className="bg-transparent w-full text-sm outline-none text-white placeholder:text-white/20"
                  />
                  {newComment.trim() && (
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      onClick={handleAddComment} 
                      className="text-[#FE2C55] font-bold text-sm ml-2 transition-all"
                    >
                      Publicar
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function App() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [followingVideos, setFollowingVideos] = useState<VideoData[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [userVideos, setUserVideos] = useState<VideoData[]>([]);
  const [userLikedVideos, setUserLikedVideos] = useState<VideoData[]>([]);
  const [isUserLikedLoading, setIsUserLikedLoading] = useState(false);
  const [userStats, setUserStats] = useState({ followers: 0, following: 0, likes: 0 });
  const [isUserVideosLoading, setIsUserVideosLoading] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'videos' | 'likes' | 'private'>('videos');
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'home' | 'friends' | 'messages' | 'profile'>('home');
  const [topTab, setTopTab] = useState<'following' | 'foryou'>('foryou');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultsUsers, setSearchResultsUsers] = useState<any[]>([]);
  const [searchResultsVideos, setSearchResultsVideos] = useState<VideoData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveViewers, setLiveViewers] = useState(1200);

  useEffect(() => {
    if (isLiveActive) {
      const interval = setInterval(() => {
        setLiveViewers(prev => prev + Math.floor(Math.random() * 21) - 10);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isLiveActive]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isPhoneStep2, setIsPhoneStep2] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<MessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [showToast, setShowToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [kwaiGolds, setKwaiGolds] = useState(1250);
  const [userInterests, setUserInterests] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(1);
  const [goldProgress, setGoldProgress] = useState(0);
  const [showGoldAnim, setShowGoldAnim] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareData, setShareData] = useState({ title: 'Kwai 2', text: '¡Mira esta increíble app!', url: window.location.href });

  const handleShare = async (platform?: string) => {
    const encodedUrl = encodeURIComponent(shareData.url);
    const encodedText = encodeURIComponent(`${shareData.title}\n\n${shareData.text}`);
    
    let shareUrl = '';
    switch (platform) {
      case 'WhatsApp':
        shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'Facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'Instagram':
        // Instagram doesn't have a direct share URL for web, usually opens the app
        setShowToast('Abre Instagram para compartir 📸');
        setIsShareOpen(false);
        return;
      case 'X':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'Telegram':
        shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'Messenger':
        shareUrl = `fb-messenger://share/?link=${encodedUrl}`;
        break;
      case 'Enlace':
        navigator.clipboard.writeText(shareData.url);
        setShowToast('Enlace copiado al portapapeles 📋');
        setIsShareOpen(false);
        return;
      default:
        if (navigator.share) {
          try {
            await navigator.share(shareData);
            setIsShareOpen(false);
            return;
          } catch (err) {
            console.log('Error sharing:', err);
          }
        }
        setShowToast('Opción no disponible en este navegador');
        setIsShareOpen(false);
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
    setIsShareOpen(false);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setKwaiGolds(data.kwaiGolds || 1250);
            setStreak(data.streak || 1);
            setUserStats({
              followers: data.followersCount || 0,
              following: data.followingCount || 0,
              likes: data.totalLikes || 0
            });
          }
        });

        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            email: user.email,
            kwaiGolds: 1250,
            followersCount: 0,
            followingCount: 0,
            totalLikes: 0,
            streak: 1,
            lastVisit: new Date().toDateString()
          });
        }
        return () => unsubscribeUser();
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);
  // Fetch User Liked Videos
  useEffect(() => {
    if (currentUser && activeTab === 'profile' && activeProfileTab === 'likes') {
      setIsUserLikedLoading(true);
      const fetchLiked = async () => {
        try {
          const q = query(
            collection(db, 'likes'),
            where('userId', '==', currentUser.uid),
            limit(20)
          );
          const snapshot = await getDocs(q);
          const videoIds = snapshot.docs.map(doc => doc.data().videoId);
          
          if (videoIds.length > 0) {
            const videosQ = query(
              collection(db, 'videos'),
              where('__name__', 'in', videoIds)
            );
            const videosSnap = await getDocs(videosQ);
            const fetched = videosSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as VideoData[];
            setUserLikedVideos(fetched);
          } else {
            setUserLikedVideos([]);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'likes');
        } finally {
          setIsUserLikedLoading(false);
        }
      };
      fetchLiked();
    }
  }, [currentUser, activeTab, activeProfileTab]);

  // Fetch User Videos
  useEffect(() => {
    if (currentUser && activeTab === 'profile') {
      setIsUserVideosLoading(true);
      const q = query(
        collection(db, 'videos'),
        where('authorId', '==', currentUser.uid),
        limit(20)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as VideoData[];
        setUserVideos(fetched);
        setIsUserVideosLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'videos/user');
        setIsUserVideosLoading(false);
      });
      return () => unsubscribe();
    }
  }, [currentUser, activeTab]);

  const [isTyping, setIsTyping] = useState(false);

  // Live Viewer Count Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLiveOpen) {
      interval = setInterval(() => {
        setLiveViewers(prev => prev + Math.floor(Math.random() * 21) - 10);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isLiveOpen]);
  // Fetch Chat Users (Friends/Recent)
  useEffect(() => {
    if (currentUser && activeTab === 'messages') {
      const q = query(collection(db, 'users'), limit(10));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.id !== currentUser.uid);
        setChatUsers(users);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'users');
      });
      return () => unsubscribe();
    }
  }, [currentUser, activeTab]);

  // Simulate typing when activeChat changes
  useEffect(() => {
    if (activeChat && isChatOpen) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeChat, isChatOpen]);

  // Listen for Chat Messages
  useEffect(() => {
    if (currentUser && activeChat && isChatOpen) {
      const q = query(
        collection(db, 'messages'),
        where('senderId', 'in', [currentUser.uid, activeChat.id]),
        where('receiverId', 'in', [currentUser.uid, activeChat.id]),
        orderBy('timestamp', 'asc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MessageData[];
        
        // Filter manually because Firestore 'in' doesn't support complex OR logic for multiple fields easily without composite indexes
        const filteredMsgs = msgs.filter(m => 
          (m.senderId === currentUser.uid && m.receiverId === activeChat.id) ||
          (m.senderId === activeChat.id && m.receiverId === currentUser.uid)
        );
        
        setChatMessages(filteredMsgs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'messages');
      });
      return () => unsubscribe();
    }
  }, [currentUser, activeChat, isChatOpen]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !activeChat || isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUser.uid,
        receiverId: activeChat.id,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    } finally {
      setIsSendingMessage(false);
    }
  };
  useEffect(() => {
    if (currentUser) {
      const q = query(
        collection(db, 'follows'),
        where('followerId', '==', currentUser.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ids = snapshot.docs.map(doc => doc.data().followingId);
        setFollowingIds(ids);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'follows');
      });
      return () => unsubscribe();
    } else {
      setFollowingIds([]);
      setFollowingVideos([]);
    }
  }, [currentUser]);

  // Fetch Following Videos
  useEffect(() => {
    if (topTab === 'following' && currentUser) {
      if (followingIds.length === 0) {
        setFollowingVideos([]);
        return;
      }

      setIsFollowingLoading(true);
      // Firestore 'in' query limit is 10, for demo we take first 10
      const idsToQuery = followingIds.slice(0, 10);
      const q = query(
        collection(db, 'videos'),
        where('authorId', 'in', idsToQuery),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as VideoData[];
        setFollowingVideos(fetched);
        setIsFollowingLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'videos/following');
        setIsFollowingLoading(false);
      });
      return () => unsubscribe();
    }
  }, [topTab, followingIds, currentUser]);

  // Search Logic
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResultsUsers([]);
        setSearchResultsVideos([]);
        return;
      }

      setIsSearching(true);
      try {
        // Search Users
        const usersQuery = query(
          collection(db, 'users'),
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff'),
          limit(5)
        );
        const usersSnap = await getDocs(usersQuery);
        setSearchResultsUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Search Videos (by description/hashtag)
        const videosQuery = query(
          collection(db, 'videos'),
          where('description', '>=', searchQuery),
          where('description', '<=', searchQuery + '\uf8ff'),
          limit(10)
        );
        const videosSnap = await getDocs(videosQuery);
        setSearchResultsVideos(videosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VideoData[]);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'search');
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  useEffect(() => {
    const q = query(
      collection(db, 'videos'),
      where('createdAt', '!=', null),
      // orderBy('createdAt', 'desc'), // Removing for now to avoid index requirement issues if not set
      limit(5)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        seedVideos();
      } else {
        const fetchedVideos = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as VideoData[];
        setVideos(fetchedVideos);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 5);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadMoreVideos = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    
    try {
      // In a real app, we'd use startAfter(lastDoc)
      // For this demo, we'll simulate "forever" by shuffling and adding more if we run out
      const q = query(
        collection(db, 'videos'),
        limit(5)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const newVideos = snapshot.docs.map(doc => ({
          id: doc.id + Math.random(), // Unique ID for infinite scroll simulation
          ...doc.data()
        })) as VideoData[];
        
        setVideos(prev => [...prev, ...newVideos]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 5);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'videos');
    } finally {
      setLoadingMore(false);
    }
  };

  const currentVideos = topTab === 'foryou' ? videos : followingVideos;

  // View time simulation for interests
  useEffect(() => {
    if (currentVideos.length > 0 && currentVideos[activeIndex]) {
      const timer = setTimeout(() => {
        updateInterests(currentVideos[activeIndex].description, 2); // More weight for long views
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeIndex, currentVideos]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
      const index = Math.round(scrollTop / clientHeight);
      
      if (index !== activeIndex) {
        setActiveIndex(index);
        const watchedVideo = currentVideos[activeIndex];
        if (watchedVideo) {
          updateInterests(watchedVideo.description, 1);
        }
      }

      // Trigger load more when 2 videos from the end
      if (scrollTop + clientHeight >= scrollHeight - clientHeight * 2) {
        loadMoreVideos();
      }
    }
  };

  const seedVideos = async () => {
    const videosCol = collection(db, 'videos');
    for (const v of MOCK_VIDEOS) {
      const videoId = v.id.toString();
      await setDoc(doc(videosCol, videoId), {
        ...v,
        id: videoId,
        createdAt: serverTimestamp()
      });
    }
  };

  const handleLogin = async () => {
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setShowToast('¡Bienvenido a Kwai 2!');
      setIsLoginModalOpen(false);
    } catch (error) {
      console.error("Login error:", error);
      setShowToast('Error al iniciar sesión');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, facebookProvider);
      setShowToast('¡Bienvenido con Facebook!');
      setIsLoginModalOpen(false);
    } catch (error) {
      console.error("Facebook login error:", error);
      setShowToast('Error al iniciar sesión con Facebook');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, appleProvider);
      setShowToast('¡Bienvenido con Apple!');
      setIsLoginModalOpen(false);
    } catch (error) {
      console.error("Apple login error:", error);
      setShowToast('Error al iniciar sesión con Apple');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log('Recaptcha resolved');
        }
      });
    }
  };

  const handlePhoneLogin = async () => {
    if (!phoneNumber) {
      setShowToast('Ingresa un número de teléfono');
      return;
    }
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setIsPhoneStep2(true);
      setShowToast('Código enviado 📱');
    } catch (error) {
      console.error("Phone login error:", error);
      setShowToast('Error al enviar código. Verifica el número.');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setIsAuthLoading(true);
    try {
      await confirmationResult.confirm(verificationCode);
      setShowToast('¡Bienvenido!');
      setIsLoginModalOpen(false);
      setIsPhoneStep2(false);
      setPhoneNumber('');
      setVerificationCode('');
    } catch (error) {
      console.error("Verification error:", error);
      setShowToast('Código incorrecto ❌');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || isUpdatingProfile) return;
    setIsUpdatingProfile(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        displayName: editName,
        username: editUsername,
        bio: editBio,
        updatedAt: serverTimestamp()
      });
      setShowToast("Perfil actualizado correctamente");
      setIsEditProfileOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setShowToast('Sesión cerrada');
  };

  // Daily Streak Bonus
  useEffect(() => {
    const lastVisit = localStorage.getItem('lastVisit');
    const today = new Date().toDateString();
    if (lastVisit !== today) {
      const currentStreak = parseInt(localStorage.getItem('streak') || '1');
      const newStreak = lastVisit ? currentStreak + 1 : 1;
      setStreak(newStreak);
      localStorage.setItem('streak', newStreak.toString());
      localStorage.setItem('lastVisit', today);
      
      // Reward
      setTimeout(() => {
        setShowToast(`¡Racha de ${newStreak} días! +100 Kwai Gold 🎁`);
        setKwaiGolds(prev => prev + 100);
      }, 1500);
    } else {
      setStreak(parseInt(localStorage.getItem('streak') || '1'));
    }
  }, []);

  // Kwai Gold Progress Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'home' && !isUploadOpen && !isSearchOpen && !isLiveOpen) {
      interval = setInterval(() => {
        setGoldProgress(prev => {
          if (prev >= 100) {
            // Variable Reward: Random jackpot chance
            const isJackpot = Math.random() > 0.95;
            const amount = isJackpot ? 500 : 50;
            setKwaiGolds(g => g + amount);
            setShowGoldAnim(true);
            if (isJackpot) setShowToast("¡JACKPOT! +500 Kwai Gold 🎰");
            setTimeout(() => setShowGoldAnim(false), 2000);
            return 0;
          }
          return prev + 2;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, isUploadOpen, isSearchOpen, isLiveOpen]);

  // Addiction Algorithm: Update interests based on engagement
  const updateInterests = (description: string, weight: number) => {
    const hashtags = description.match(/#\w+/g) || [];
    if (hashtags.length === 0) return;
    
    setUserInterests(prev => {
      const next = { ...prev };
      hashtags.forEach(tag => {
        next[tag] = (next[tag] || 0) + weight;
      });
      return next;
    });
  };

  // Interest decay over time
  useEffect(() => {
    const decayInterval = setInterval(() => {
      setUserInterests(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(tag => {
          if (next[tag] > 0.1) {
            next[tag] *= 0.95; // 5% decay
            changed = true;
          } else {
            delete next[tag];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 60000); // Every minute
    return () => clearInterval(decayInterval);
  }, []);

  const getEngagementScore = (video: VideoData): number => {
    const hashtags = (video.description.match(/#\w+/g) || []) as string[];
    return hashtags.reduce((acc: number, tag: string) => acc + (userInterests[tag] || 0), 0);
  };

  // Re-sort videos to prioritize high-engagement content
  useEffect(() => {
    if (Object.keys(userInterests).length > 0) {
      setVideos(prev => {
        const sorted = [...prev].sort((a, b) => getEngagementScore(b) - getEngagementScore(a));
        // Check if order actually changed to avoid infinite loop
        if (JSON.stringify(sorted.map(v => v.id)) === JSON.stringify(prev.map(v => v.id))) return prev;
        return sorted;
      });
    }
  }, [userInterests]);

  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      const url = URL.createObjectURL(file);
      setUploadPreview(url);
    }
  };

  const handlePost = async () => {
    if (uploadFile && currentUser) {
      setIsUploading(true);
      const videoId = Date.now().toString();
      const storageRef = ref(storage, `videos/${currentUser.uid}/${videoId}`);
      const uploadTask = uploadBytesResumable(storageRef, uploadFile);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error("Upload error:", error);
          setIsUploading(false);
          setShowToast('Error al subir el video ❌');
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const newVideo = {
            id: videoId,
            url: downloadURL,
            user: currentUser.displayName || 'Me',
            userPhoto: currentUser.photoURL || '',
            description: uploadDescription || 'Nuevo video subido! 🚀',
            likes: 0,
            comments: 0,
            bookmarks: 0,
            shares: 0,
            music: 'Original Sound - Me',
            filter: selectedFilter,
            authorId: currentUser.uid,
            createdAt: serverTimestamp()
          };
          
          await setDoc(doc(db, 'videos', videoId), newVideo);
          
          setIsUploading(false);
          setUploadProgress(0);
          setIsUploadOpen(false);
          setUploadPreview(null);
          setUploadFile(null);
          setUploadDescription('');
          setSelectedFilter('none');
          setActiveIndex(0);
          if (containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setShowToast('¡Video subido con éxito! 🚀');
        }
      );
    } else if (!uploadFile) {
      setShowToast('Selecciona un video primero');
    } else if (!currentUser) {
      setShowToast('Inicia sesión para publicar');
    }
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-black overflow-hidden relative font-sans">
      {isAuthLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-10 h-10 text-yellow-400" />
          </motion.div>
        </div>
      )}
      {/* Top Navigation */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center space-x-2">
          {/* Kwai Gold Widget */}
          <div className="relative mr-2">
            <svg className="w-10 h-10 -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <motion.circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="#FFD700"
                strokeWidth="2"
                strokeDasharray="113"
                animate={{ strokeDashoffset: 113 - (113 * goldProgress) / 100 }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-black font-black text-[10px]">K</span>
              </div>
            </div>
            <AnimatePresence>
              {showGoldAnim && (
                <motion.div
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: 1, y: -40, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <span className="text-yellow-400 font-bold text-xs">+50</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button 
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setIsWalletOpen(true)} 
            className="relative group flex items-center space-x-1"
          >
            <div className="absolute -inset-1 bg-yellow-400 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-black rounded-full p-1 border border-yellow-400/50 flex items-center space-x-1 px-2">
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-yellow-400 font-bold">{streak}d</span>
            </div>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setIsLiveActive(true)} 
            className="relative"
          >
            <Tv className="w-6 h-6 text-white" />
            <div className="absolute -top-1 -right-1 bg-[#FE2C55] rounded-sm px-0.5 py-0">
              <span className="text-[8px] font-bold text-white leading-none">LIVE</span>
            </div>
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setIsNotificationsOpen(true)} 
            className="relative transition-transform"
          >
            <Bell className="w-6 h-6 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#FE2C55] rounded-full border border-black flex items-center justify-center">
              <span className="text-[6px] font-bold text-white">3</span>
            </div>
          </motion.button>
          <span className="text-white font-black italic tracking-tighter text-xl">Kwai 2</span>
        </div>
        <div className="flex items-center space-x-4">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setTopTab('following')}
            className={`text-sm font-bold transition-colors ${topTab === 'following' ? 'text-white' : 'text-white/60'}`}
          >
            Siguiendo
          </motion.button>
          <div className="relative">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setTopTab('foryou')}
              className={`text-sm font-bold transition-colors ${topTab === 'foryou' ? 'text-white' : 'text-white/60'}`}
            >
              Para ti
            </motion.button>
            {topTab === 'foryou' && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-white rounded-full" />
            )}
            {topTab === 'following' && (
              <div className="absolute -bottom-1 -left-[70px] w-4 h-0.5 bg-white rounded-full" />
            )}
          </div>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.1 }}
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="w-6 h-6 text-white" />
        </motion.button>
      </div>

      {/* Video Feed */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {topTab === 'following' && !currentUser ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Inicia sesión para ver a quién sigues</h3>
            <p className="text-gray-400 text-sm mb-8">Sigue a tus creadores favoritos para ver sus últimos videos aquí.</p>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-[#FE2C55] text-white px-12 py-3 rounded-lg font-bold shadow-lg transition-transform"
            >
              Iniciar sesión
            </motion.button>
          </div>
        ) : topTab === 'following' && followingIds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <Plus className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Aún no sigues a nadie</h3>
            <p className="text-gray-400 text-sm mb-8">¡Explora la pestaña "Para ti" y encuentra creadores increíbles!</p>
            <button 
              onClick={() => setTopTab('foryou')}
              className="bg-white text-black px-12 py-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform"
            >
              Explorar videos
            </button>
          </div>
        ) : isFollowingLoading && topTab === 'following' ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#FE2C55] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          currentVideos.map((video, index) => (
            <VideoCard 
              key={video.id} 
              video={video} 
              isActive={index === activeIndex} 
              setShowToast={setShowToast}
              onLike={(desc) => updateInterests(desc, 5)}
              currentUser={currentUser}
            />
          ))
        )}
      </div>

      {/* Tab Content Placeholder */}
      <div className="h-[72px] bg-black border-t border-white/10 flex items-center justify-around px-2 z-20">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('home')}
          className="flex flex-col items-center"
        >
          <Home className={`w-6 h-6 ${activeTab === 'home' ? 'text-white' : 'text-white/60'}`} />
          <span className={`text-[10px] mt-1 ${activeTab === 'home' ? 'text-white' : 'text-white/60'}`}>Inicio</span>
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('friends')}
          className="flex flex-col items-center relative"
        >
          <Users className={`w-6 h-6 ${activeTab === 'friends' ? 'text-white' : 'text-white/60'}`} />
          <span className={`text-[10px] mt-1 ${activeTab === 'friends' ? 'text-white' : 'text-white/60'}`}>Amigos</span>
          <div className="absolute -top-1 -right-2 bg-[#FE2C55] text-white text-[10px] px-1 rounded-full font-bold">99</div>
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsUploadOpen(true)}
          className="flex flex-col items-center"
        >
          <div className="relative w-12 h-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-cyan-400 rounded-lg translate-x-[-2px]" />
            <div className="absolute inset-0 bg-[#FE2C55] rounded-lg translate-x-[2px]" />
            <div className="absolute inset-0 bg-white rounded-lg flex items-center justify-center">
              <Plus className="w-6 h-6 text-black" />
            </div>
          </div>
          <span className="text-[10px] mt-1 text-white/60">Subir</span>
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('messages')}
          className="flex flex-col items-center relative"
        >
          <MessageSquare className={`w-6 h-6 ${activeTab === 'messages' ? 'text-white' : 'text-white/60'}`} />
          <span className={`text-[10px] mt-1 ${activeTab === 'messages' ? 'text-white' : 'text-white/60'}`}>Mensajes</span>
          <div className="absolute -top-1 -right-1 bg-[#FE2C55] w-2 h-2 rounded-full" />
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('profile')}
          className="flex flex-col items-center"
        >
          {currentUser ? (
            <img 
              src={currentUser.photoURL || ''} 
              className={`w-6 h-6 rounded-full border ${activeTab === 'profile' ? 'border-white' : 'border-transparent'}`}
              alt="profile"
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className={`w-6 h-6 ${activeTab === 'profile' ? 'text-white' : 'text-white/60'}`} />
          )}
          <span className={`text-[10px] mt-1 ${activeTab === 'profile' ? 'text-white' : 'text-white/60'}`}>Perfil</span>
        </motion.button>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute inset-0 bg-black z-[100] flex flex-col"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => { setIsUploadOpen(false); setUploadPreview(null); }} 
                className="text-white"
                disabled={isUploading}
              >
                <Plus className="w-6 h-6 rotate-45" />
              </motion.button>
              <h4 className="font-bold text-white">Subir video</h4>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={handlePost}
                disabled={!uploadPreview || isUploading}
                className={`font-bold transition-colors flex items-center space-x-2 ${uploadPreview && !isUploading ? 'text-yellow-400' : 'text-white/20'}`}
              >
                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isUploading ? 'Subiendo...' : 'Publicar'}</span>
              </motion.button>
            </div>

            {isUploading && (
              <div className="w-full h-1 bg-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-yellow-400"
                />
              </div>
            )}

            <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto space-y-8 no-scrollbar">
              {uploadPreview ? (
                <div className="relative w-full aspect-[9/16] max-h-[50vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <video 
                    src={uploadPreview} 
                    className="w-full h-full object-cover" 
                    style={{ filter: selectedFilter }}
                    controls 
                  />
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setUploadPreview(null)}
                    className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/80 transition-colors"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </motion.button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[9/16] max-h-[50vh] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-4 cursor-pointer hover:bg-white/5 transition-all group"
                >
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-10 h-10 text-white/20" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-white/60 font-bold">Seleccionar video</p>
                    <p className="text-white/20 text-xs">MP4 o WebM hasta 100MB</p>
                  </div>
                </div>
              )}

              {uploadPreview && (
                <div className="w-full space-y-4">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Filtros</label>
                  <div className="flex space-x-3 overflow-x-auto pb-2 no-scrollbar">
                    {[
                      { name: 'Normal', value: 'none' },
                      { name: 'Gris', value: 'grayscale(100%)' },
                      { name: 'Sepia', value: 'sepia(100%)' },
                      { name: 'Invertir', value: 'invert(100%)' },
                      { name: 'Brillante', value: 'brightness(150%)' },
                      { name: 'Contraste', value: 'contrast(200%)' },
                    ].map((f) => (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.05 }}
                        key={f.value}
                        onClick={() => setSelectedFilter(f.value)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          selectedFilter === f.value 
                            ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' 
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {f.name}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              <input 
                ref={fileInputRef}
                type="file" 
                accept="video/*" 
                className="hidden" 
                onChange={handleFileChange}
              />

              <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Descripción</label>
                  <span className="text-[10px] text-white/20 font-bold">{uploadDescription.length}/150</span>
                </div>
                <textarea 
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value.slice(0, 150))}
                  placeholder="Escribe una descripción creativa... Usa #etiquetas"
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-yellow-400/50 transition-colors h-32 resize-none"
                />
                <div className="flex items-center space-x-2 text-[10px] text-white/20">
                  <Sparkles className="w-3 h-3" />
                  <p>Tu video será visible para todos los usuarios</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 bg-black z-[100] flex flex-col"
          >
            <div className="p-4 flex items-center space-x-4">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }} 
                className="text-white"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </motion.button>
              <div className="flex-1 bg-white/10 rounded-full px-4 py-2 flex items-center space-x-2">
                <Search className="w-4 h-4 text-white/60" />
                <input 
                  type="text" 
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en Kwai 2" 
                  className="bg-transparent w-full text-white outline-none"
                />
                {searchQuery && (
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setSearchQuery('')}
                  >
                    <Plus className="w-4 h-4 text-white/40 rotate-45" />
                  </motion.button>
                )}
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 no-scrollbar">
              {searchQuery.trim() ? (
                <div className="space-y-6">
                  {isSearching ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-2 border-[#FE2C55] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* User Results */}
                      {searchResultsUsers.length > 0 && (
                        <div>
                          <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-4">Usuarios</h4>
                          <div className="space-y-4">
                            {searchResultsUsers.map(user => (
                              <div key={user.id} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                                    <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} className="w-full h-full object-cover" alt="" />
                                  </div>
                                  <div>
                                    <p className="text-white font-bold text-sm">{user.displayName}</p>
                                    <p className="text-white/40 text-xs">@{user.displayName?.toLowerCase().replace(/\s/g, '')}</p>
                                  </div>
                                </div>
                                <motion.button 
                                  whileTap={{ scale: 0.95 }}
                                  whileHover={{ scale: 1.05 }}
                                  className="bg-[#FE2C55] text-white px-4 py-1.5 rounded-full text-xs font-bold"
                                >
                                  Seguir
                                </motion.button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Video Results */}
                      {searchResultsVideos.length > 0 && (
                        <div>
                          <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-4">Videos</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {searchResultsVideos.map(video => (
                              <div key={video.id} className="aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden relative group">
                                <video src={video.url} className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-2">
                                  <p className="text-white text-[10px] line-clamp-2">{video.description}</p>
                                  <div className="flex items-center space-x-1 mt-1">
                                    <Heart className="w-2 h-2 text-white fill-white" />
                                    <span className="text-white text-[8px]">{video.likes}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {searchResultsUsers.length === 0 && searchResultsVideos.length === 0 && (
                        <div className="text-center py-20">
                          <Search className="w-12 h-12 text-white/10 mx-auto mb-4" />
                          <p className="text-white/40">No se encontraron resultados para "{searchQuery}"</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <h4 className="text-white/60 text-sm mb-4">Búsquedas recientes</h4>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {['baile', 'comida', 'humor', 'gaming'].map(tag => (
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        key={tag} 
                        onClick={() => setSearchQuery(tag)}
                        className="bg-white/5 text-white px-4 py-1 rounded-full text-sm hover:bg-white/10 transition-colors"
                      >
                        #{tag}
                      </motion.button>
                    ))}
                  </div>

                  <h4 className="text-white font-bold text-sm mb-4 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2 text-yellow-400" />
                    Tendencias en Kwai 2
                  </h4>
                  <div className="space-y-4">
                    {[
                      { title: '#RetoKwai2026', views: '1.2B' },
                      { title: '#RecetasEn1Minuto', views: '850M' },
                      { title: '#BailaConmigo', views: '2.5B' },
                      { title: '#GamerLife', views: '450M' },
                    ].map((trend, i) => (
                      <motion.div 
                        whileTap={{ scale: 0.98 }}
                        key={i} 
                        onClick={() => setSearchQuery(trend.title.replace('#', ''))}
                        className="flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-white/40 text-xs font-bold">
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{trend.title}</p>
                            <p className="text-white/40 text-[10px]">{trend.views} visualizaciones</p>
                          </div>
                        </div>
                        <Share2 className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Overlay */}
      <AnimatePresence>
        {isLiveOpen && (
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            className="absolute inset-0 bg-black z-[150] flex flex-col"
          >
            {/* Live Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=streamer`} 
                    className="w-10 h-10 rounded-full border-2 border-[#FE2C55]"
                    alt="streamer"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#FE2C55] text-[8px] px-1 rounded-sm font-bold text-white">LIVE</div>
                </div>
                <div>
                  <p className="text-white font-bold text-xs">@StreamerPro</p>
                  <p className="text-white/60 text-[10px]">{liveViewers.toLocaleString()} espectadores</p>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  className="bg-[#FE2C55] text-white px-3 py-1 rounded-full text-[10px] font-bold"
                >
                  Seguir
                </motion.button>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <img 
                      key={i}
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=viewer${i}`} 
                      className="w-6 h-6 rounded-full border border-black"
                      alt="viewer"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={() => setIsLiveOpen(false)} 
                  className="text-white"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </motion.button>
              </div>
            </div>

            {/* Live Content (Mock) */}
            <div className="flex-1 relative overflow-hidden">
              <img 
                src="https://picsum.photos/seed/stream/1080/1920" 
                className="w-full h-full object-cover"
                alt="live content"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20" />
              
              {/* Floating Hearts/Gifts */}
              <div className="absolute bottom-24 right-4 flex flex-col items-center space-y-4">
                <motion.div 
                  animate={{ y: [0, -20, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Sparkles className="w-6 h-6 text-black" />
                </motion.div>
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Live Chat */}
              <div className="absolute bottom-20 left-4 right-16 max-h-48 overflow-y-auto no-scrollbar flex flex-col-reverse space-y-reverse space-y-2">
                {[
                  { user: 'Juan', text: '¡Increíble stream! 🔥' },
                  { user: 'Maria', text: 'Salúdame por favor 👋' },
                  { user: 'Pedro', text: '¿De dónde eres?' },
                  { user: 'KwaiFan', text: '¡Me encanta Kwai 2!' },
                ].map((chat, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <span className="text-yellow-400 font-bold text-xs">@{chat.user}:</span>
                    <span className="text-white text-xs">{chat.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Footer */}
            <div className="p-4 bg-black/40 backdrop-blur-md flex items-center space-x-3">
              <div className="flex-1 bg-white/10 rounded-full px-4 py-2 flex items-center">
                <input 
                  type="text" 
                  placeholder="Di algo..." 
                  className="bg-transparent w-full text-white outline-none text-sm"
                />
              </div>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg"
              >
                <Sparkles className="w-6 h-6 text-black" />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 bg-[#FE2C55] rounded-full flex items-center justify-center shadow-lg"
              >
                <Share2 className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Content Placeholder */}
      <AnimatePresence>
        {activeTab !== 'home' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-10 flex flex-col items-center justify-center pt-16"
          >
            {activeTab === 'friends' && (
              <div className="text-center w-full px-4">
                <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-white font-bold mb-6">Sugerencias para ti</h3>
                <div className="space-y-4">
                  {[
                    { name: 'GamerPro', bio: 'Amo los videojuegos 🎮', followers: '1.2M' },
                    { name: 'ChefKwai', bio: 'Recetas rápidas y ricas 🍳', followers: '850K' },
                    { name: 'DanceQueen', bio: 'Baila conmigo! 💃', followers: '2.5M' },
                  ].map((friend, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} 
                          className="w-12 h-12 rounded-full bg-white/10"
                          alt={friend.name}
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-left">
                          <p className="text-white font-bold text-sm">@{friend.name}</p>
                          <p className="text-white/40 text-[10px]">{friend.bio}</p>
                          <p className="text-yellow-400 text-[10px] font-bold">{friend.followers} seguidores</p>
                        </div>
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        className="bg-[#FE2C55] text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                      >
                        Seguir
                      </motion.button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'messages' && (
              <div className="w-full h-full flex flex-col pt-4">
                <div className="px-4 mb-6">
                  <h3 className="text-white font-bold text-lg">Mensajes</h3>
                  <div className="flex space-x-4 overflow-x-auto py-4 no-scrollbar">
                    {chatUsers.map(user => (
                      <motion.div 
                        whileTap={{ scale: 0.9 }}
                        key={user.id} 
                        onClick={() => {
                          setActiveChat(user);
                          setIsChatOpen(true);
                        }}
                        className="flex flex-col items-center space-y-1 min-w-[60px] cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-full border-2 border-[#FE2C55] p-0.5">
                          <img 
                            src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} 
                            className="w-full h-full rounded-full bg-white/10"
                            alt="story"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className="text-[10px] text-white/60 truncate w-14 text-center">{user.displayName}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 space-y-4">
                  {chatUsers.length > 0 ? (
                    chatUsers.map((user) => (
                    <motion.div 
                      whileTap={{ scale: 0.95 }}
                      key={user.id} 
                      onClick={() => {
                        setActiveChat(user);
                        setIsChatOpen(true);
                      }}
                      className="flex items-center justify-between group cursor-pointer transition-transform"
                    >
                        <div className="flex items-center space-x-3">
                          <img 
                            src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} 
                            className="w-12 h-12 rounded-full bg-white/10"
                            alt={user.displayName}
                            referrerPolicy="no-referrer"
                          />
                          <div className="text-left">
                            <p className="text-white font-bold text-sm">{user.displayName}</p>
                            <p className="text-white/40 text-xs">Toca para chatear</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <span className="text-[10px] text-white/40">Ahora</span>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-white/20">
                      <MessageSquare className="w-12 h-12 mb-2" />
                      <p className="text-sm">No tienes mensajes aún</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="w-full h-full bg-black flex flex-col">
                <div className="p-4 flex items-center justify-between border-b border-white/10">
                  <h2 className="font-bold text-white">Perfil</h2>
                  <div className="flex items-center space-x-4">
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      onClick={() => setIsShareOpen(true)}
                      className="text-white hover:text-white/80 transition-colors"
                    >
                      <Share2 className="w-6 h-6" />
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      onClick={() => setIsWalletOpen(true)} 
                      className="text-yellow-400 hover:text-yellow-300 transition-colors"
                    >
                      <Coins className="w-6 h-6" />
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      onClick={() => setIsEditProfileOpen(true)} 
                      className="text-white hover:text-white/80 transition-colors"
                    >
                      <Plus className="w-6 h-6 rotate-45" />
                    </motion.button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                  <div className="p-8 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-white/10 mb-4 overflow-hidden border-4 border-white/5 shadow-2xl relative group">
                      {currentUser ? (
                        <img 
                          src={currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.displayName}`} 
                          className="w-full h-full object-cover"
                          alt="profile"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                          <User className="w-12 h-12 text-white/20" />
                        </div>
                      )}
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.1 }}
                        onClick={() => setIsEditProfileOpen(true)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Camera className="w-6 h-6 text-white" />
                      </motion.button>
                    </div>
                    
                    <h3 className="text-xl font-bold mb-1 text-white">
                      {currentUser ? currentUser.displayName : 'Invitado'}
                    </h3>
                    <p className="text-white/40 text-sm mb-6">
                      {currentUser ? `@${currentUser.displayName?.toLowerCase().replace(/\s/g, '')}` : 'Inicia sesión para ver más'}
                    </p>

                    {currentUser ? (
                      <>
                        <div className="flex space-x-8 mb-8">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-white">{userStats.following}</span>
                            <span className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Siguiendo</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-white">{userStats.followers}</span>
                            <span className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Seguidores</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-white">{userStats.likes}</span>
                            <span className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Me gusta</span>
                          </div>
                        </div>

                        <div className="flex space-x-2 w-full px-4 mb-8">
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setIsEditProfileOpen(true)}
                            className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            Editar perfil
                          </motion.button>
                          {currentUser?.email === 'yabhel452962@gmail.com' && (
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => {
                                seedVideos();
                                setShowToast("Sembrando base de datos...");
                                setTimeout(() => setShowToast(null), 3000);
                              }}
                              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                              title="Sembrar Base de Datos"
                            >
                              <Database className="w-5 h-5" />
                            </motion.button>
                          )}
                          <motion.button 
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: 1.1 }}
                            onClick={handleLogout}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="w-5 h-5" />
                          </motion.button>
                        </div>

                        {/* Kwai Gold Card */}
                        <div className="w-full px-4 mb-8">
                          <motion.div 
                            whileTap={{ scale: 0.98 }}
                            whileHover={{ scale: 1.02 }}
                            className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl p-5 flex items-center justify-between shadow-xl relative overflow-hidden group cursor-pointer" 
                            onClick={() => setIsWalletOpen(true)}
                          >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                              <Coins className="w-16 h-16" />
                            </div>
                            <div className="flex items-center space-x-4 relative z-10">
                              <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center">
                                <Coins className="w-7 h-7 text-black/80" />
                              </div>
                              <div className="text-left">
                                <p className="text-black/60 text-[10px] font-bold uppercase tracking-widest">Saldo Kwai Gold</p>
                                <p className="text-black font-black text-2xl leading-none">{kwaiGolds.toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="bg-black text-white p-2 rounded-full shadow-lg relative z-10">
                              <ArrowUpRight className="w-4 h-4" />
                            </div>
                          </motion.div>
                        </div>

                        {/* Daily Tasks */}
                        <div className="w-full px-4 mb-8">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-white font-bold text-sm flex items-center">
                              <Sparkles className="w-4 h-4 mr-2 text-yellow-500" />
                              Tareas Diarias
                            </h4>
                            <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Reinicia en 12h</span>
                          </div>
                          <div className="space-y-3">
                            {[
                              { id: 1, title: 'Ver 5 minutos de videos', reward: 200, done: false, icon: Play },
                              { id: 2, title: 'Dar 10 likes', reward: 100, done: true, icon: Heart },
                              { id: 3, title: 'Compartir 1 video', reward: 150, done: false, icon: Share2 },
                            ].map(task => (
                              <div key={task.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-colors">
                                <div className="flex items-center space-x-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${task.done ? 'bg-green-500/10' : 'bg-white/5'}`}>
                                    <task.icon className={`w-5 h-5 ${task.done ? 'text-green-500' : 'text-white/40'}`} />
                                  </div>
                                  <div>
                                    <p className="text-white text-xs font-bold">{task.title}</p>
                                    <p className="text-yellow-400 text-[10px] font-bold">+{task.reward} Kwai Gold</p>
                                  </div>
                                </div>
                                <motion.button 
                                  whileTap={!task.done ? { scale: 0.95 } : {}}
                                  whileHover={!task.done ? { scale: 1.05 } : {}}
                                  onClick={() => {
                                    if (!task.done) {
                                      setKwaiGolds(prev => prev + task.reward);
                                      setShowGoldAnim(true);
                                      setShowToast(`¡Has ganado ${task.reward} Kwai Gold! 💰`);
                                      setTimeout(() => {
                                        setShowGoldAnim(false);
                                        setShowToast(null);
                                      }, 2000);
                                    }
                                  }}
                                  disabled={task.done}
                                  className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${
                                    task.done 
                                      ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                                      : 'bg-yellow-400 text-black'
                                  }`}
                                >
                                  {task.done ? 'Completado' : 'Reclamar'}
                                </motion.button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full flex flex-col items-center space-y-6 py-10">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                          <User className="w-10 h-10 text-white/20" />
                        </div>
                        <div className="text-center space-y-2">
                          <h4 className="text-white font-bold text-lg">Inicia sesión en Kwai 2</h4>
                          <p className="text-white/40 text-sm px-10">Gestiona tu perfil, ve tus estadísticas y canjea tus Kwai Gold.</p>
                        </div>
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          whileHover={{ scale: 1.05 }}
                          onClick={() => setIsLoginModalOpen(true)}
                          className="w-full max-w-xs py-4 bg-[#FE2C55] text-white rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-transform"
                        >
                          <LogIn className="w-5 h-5" />
                          <span>Iniciar sesión</span>
                        </motion.button>
                        <p className="text-[10px] text-white/20 text-center px-10 leading-relaxed">
                          Al continuar, aceptas nuestros <span className="text-white/40 underline">Términos de servicio</span> y confirmas que has leído nuestra <span className="text-white/40 underline">Política de privacidad</span>.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-100 mt-4">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveProfileTab('videos')}
                      className={`flex-1 py-3 flex justify-center items-center relative ${activeProfileTab === 'videos' ? 'text-black' : 'text-gray-400'}`}
                    >
                      <Grid className="w-5 h-5" />
                      {activeProfileTab === 'videos' && <div className="absolute bottom-0 w-12 h-0.5 bg-black" />}
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveProfileTab('likes')}
                      className={`flex-1 py-3 flex justify-center items-center relative ${activeProfileTab === 'likes' ? 'text-black' : 'text-gray-400'}`}
                    >
                      <Heart className="w-5 h-5" />
                      {activeProfileTab === 'likes' && <div className="absolute bottom-0 w-12 h-0.5 bg-black" />}
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveProfileTab('private')}
                      className={`flex-1 py-3 flex justify-center items-center relative ${activeProfileTab === 'private' ? 'text-black' : 'text-gray-400'}`}
                    >
                      <Lock className="w-5 h-5" />
                      {activeProfileTab === 'private' && <div className="absolute bottom-0 w-12 h-0.5 bg-black" />}
                    </motion.button>
                  </div>

                  {/* Video Grid */}
                  <div className="grid grid-cols-3 gap-0.5 mt-0.5 pb-20">
                    {activeProfileTab === 'videos' ? (
                      isUserVideosLoading ? (
                        [1, 2, 3].map(i => (
                          <div key={i} className="aspect-[3/4] bg-gray-100 animate-pulse" />
                        ))
                      ) : userVideos.length > 0 ? (
                        userVideos.map((v) => (
                          <div key={v.id} className="aspect-[3/4] bg-black relative group cursor-pointer overflow-hidden">
                            <video src={v.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-1 left-1 flex items-center space-x-1">
                              <Heart className="w-3 h-3 text-white fill-white" />
                              <span className="text-white text-[10px] font-bold">{v.likes}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-3 py-20 flex flex-col items-center justify-center text-gray-400">
                          <Video className="w-12 h-12 mb-2 opacity-20" />
                          <p className="text-sm">Aún no has subido videos</p>
                        </div>
                      )
                    ) : activeProfileTab === 'likes' ? (
                      isUserLikedLoading ? (
                        [1, 2, 3].map(i => (
                          <div key={i} className="aspect-[3/4] bg-gray-100 animate-pulse" />
                        ))
                      ) : userLikedVideos.length > 0 ? (
                        userLikedVideos.map((v) => (
                          <div key={v.id} className="aspect-[3/4] bg-black relative group cursor-pointer overflow-hidden">
                            <video src={v.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-1 left-1 flex items-center space-x-1">
                              <Heart className="w-3 h-3 text-white fill-white" />
                              <span className="text-white text-[10px] font-bold">{v.likes}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-3 py-20 flex flex-col items-center justify-center text-gray-400">
                          <Heart className="w-12 h-12 mb-2 opacity-20" />
                          <p className="text-sm">No has dado me gusta a ningún video</p>
                        </div>
                      )
                    ) : (
                      <div className="col-span-3 py-20 flex flex-col items-center justify-center text-gray-400">
                        <Lock className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-sm">Esta sección es privada</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Overlay */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            className="absolute inset-0 bg-black z-[140] flex flex-col"
          >
            <div className="p-4 bg-[#121212] border-b border-white/5 flex items-center justify-between">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => setIsNotificationsOpen(false)} 
                className="text-white p-2"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </motion.button>
              <h4 className="font-bold text-white">Notificaciones</h4>
              <div className="w-10" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h5 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Hoy</h5>
                <div className="space-y-4">
                  {[
                    { type: 'like', user: 'Cu3rvoN3gro', content: 'le dio me gusta a tu video', time: '2m' },
                    { type: 'follow', user: 'NatureVibes', content: 'comenzó a seguirte', time: '1h' },
                    { type: 'comment', user: 'DanceMaster', content: 'comentó: "¡Increíble paso! 🔥"', time: '3h' },
                  ].map((notif, i) => (
                    <motion.div 
                      whileTap={{ scale: 0.98 }}
                      key={i} 
                      className="flex items-center space-x-3 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors"
                    >
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.user}`} 
                        className="w-10 h-10 rounded-full bg-white/10"
                        alt={notif.user}
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1">
                        <p className="text-white text-xs">
                          <span className="font-bold">@{notif.user}</span> {notif.content}
                        </p>
                        <p className="text-white/40 text-[10px]">{notif.time}</p>
                      </div>
                      <div className="w-10 h-10 bg-white/5 rounded-lg overflow-hidden">
                        <img src="https://picsum.photos/seed/kwai/100/100" className="w-full h-full object-cover opacity-50" alt="thumb" referrerPolicy="no-referrer" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Ayer</h5>
                <div className="space-y-4">
                  {[
                    { type: 'mention', user: 'ChefKwai', content: 'te mencionó en un comentario', time: '1d' },
                    { type: 'follow', user: 'GamerPro', content: 'comenzó a seguirte', time: '1d' },
                  ].map((notif, i) => (
                    <motion.div 
                      whileTap={{ scale: 0.98 }}
                      key={i} 
                      className="flex items-center space-x-3 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors"
                    >
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.user}`} 
                        className="w-10 h-10 rounded-full bg-white/10"
                        alt={notif.user}
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1">
                        <p className="text-white text-xs">
                          <span className="font-bold">@{notif.user}</span> {notif.content}
                        </p>
                        <p className="text-white/40 text-[10px]">{notif.time}</p>
                      </div>
                      {notif.type !== 'follow' && (
                        <div className="w-10 h-10 bg-white/5 rounded-lg overflow-hidden">
                          <img src="https://picsum.photos/seed/kwai2/100/100" className="w-full h-full object-cover opacity-50" alt="thumb" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isChatOpen && activeChat && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-0 bg-black z-[130] flex flex-col"
          >
            <div className="p-4 bg-[#121212] border-b border-white/5 flex items-center space-x-4">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => setIsChatOpen(false)} 
                className="text-white p-2"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </motion.button>
              <div className="flex items-center space-x-3">
                <img 
                  src={activeChat.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.displayName}`} 
                  className="w-8 h-8 rounded-full bg-white/10"
                  alt={activeChat.displayName}
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="text-white font-bold text-sm">{activeChat.displayName}</p>
                  <p className="text-green-500 text-[10px]">En línea</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              <div className="flex justify-center">
                <span className="text-[10px] text-white/20 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">Chat iniciado</span>
              </div>
              
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${
                    msg.senderId === currentUser?.uid 
                      ? 'bg-[#FE2C55] text-white rounded-tr-none' 
                      : 'bg-white/10 text-white rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-[#121212] border-t border-white/5 flex items-center space-x-3">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                className="text-white/60 hover:text-white p-2"
              >
                <Plus className="w-6 h-6" />
              </motion.button>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex-1 bg-white/5 rounded-full px-4 py-2 flex items-center"
              >
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Enviar mensaje..." 
                  className="bg-transparent w-full text-white outline-none text-sm"
                />
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.1 }}
                  type="submit"
                  disabled={!newMessage.trim() || isSendingMessage}
                  className="text-[#FE2C55] font-bold text-sm ml-2 disabled:opacity-50"
                >
                  {isSendingMessage ? '...' : 'Enviar'}
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isEditProfileOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute inset-0 bg-black z-[200] flex flex-col"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => setIsEditProfileOpen(false)} 
                className="text-white"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </motion.button>
              <h3 className="text-white font-bold">Editar Perfil</h3>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={handleUpdateProfile}
                disabled={isUpdatingProfile}
                className="text-yellow-400 font-bold text-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {isUpdatingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isUpdatingProfile ? 'Guardando...' : 'Guardar'}</span>
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <img 
                    src={currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.displayName}`} 
                    className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/20"
                    alt="profile"
                    referrerPolicy="no-referrer"
                  />
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    className="absolute bottom-0 right-0 bg-yellow-400 p-2 rounded-full shadow-lg"
                  >
                    <Camera className="w-4 h-4 text-black" />
                  </motion.button>
                </div>
                <p className="text-white/40 text-xs text-center">Toca para cambiar la foto de perfil</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider">Nombre</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-400/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider">Nombre de usuario</label>
                  <input 
                    type="text" 
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="nombre_de_usuario"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-400/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider">Bio</label>
                  <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Cuéntanos algo sobre ti..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-400/50 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet Overlay */}
      <AnimatePresence>
        {isWalletOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute inset-0 bg-black z-[200] flex flex-col"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => setIsWalletOpen(false)} 
                className="text-white"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </motion.button>
              <h3 className="text-white font-bold">Mi Billetera</h3>
              <div className="w-6" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl p-8 text-black shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <Coins className="w-32 h-32 rotate-12" />
                </div>
                <div className="relative z-10">
                  <p className="text-black/60 font-bold text-xs uppercase tracking-widest mb-2">Balance Total</p>
                  <div className="flex items-baseline space-x-2">
                    <h2 className="text-5xl font-black">{kwaiGolds.toLocaleString()}</h2>
                    <span className="font-bold text-sm">Kwai Gold</span>
                  </div>
                  <div className="mt-8 flex items-center space-x-4">
                    <div className="bg-black/10 px-4 py-2 rounded-2xl">
                      <p className="text-[10px] font-bold opacity-60">Hoy</p>
                      <p className="font-bold">+{goldProgress} Gold</p>
                    </div>
                    <div className="bg-black/10 px-4 py-2 rounded-2xl">
                      <p className="text-[10px] font-bold opacity-60">Valor est.</p>
                      <p className="font-bold">${(kwaiGolds / 1000).toFixed(2)} USD</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center space-y-2 hover:bg-white/10 transition-colors"
                >
                  <div className="w-10 h-10 bg-green-400/20 rounded-full flex items-center justify-center">
                    <ArrowUpRight className="w-6 h-6 text-green-400" />
                  </div>
                  <span className="text-white font-bold text-sm">Retirar</span>
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center space-y-2 hover:bg-white/10 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-400/20 rounded-full flex items-center justify-center">
                    <History className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-white font-bold text-sm">Historial</span>
                </motion.button>
              </div>

              <div className="space-y-4">
                <h4 className="text-white font-bold text-sm px-1">Opciones de Canje</h4>
                <div className="space-y-3">
                  {[
                    { amount: '5.00', gold: '50,000', label: 'Retiro Directo' },
                    { amount: '10.00', gold: '100,000', label: 'Retiro Directo' },
                    { amount: '20.00', gold: '200,000', label: 'Retiro Directo' },
                  ].map((option, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-yellow-400/30 transition-all">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center">
                          <Coins className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">${option.amount} USD</p>
                          <p className="text-white/40 text-[10px]">{option.label}</p>
                        </div>
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.05 }}
                        className="bg-yellow-400 text-black px-4 py-2 rounded-xl text-xs font-bold transition-transform"
                      >
                        {option.gold} Gold
                      </motion.button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute inset-0 bg-black/60 z-[110] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 bg-[#121212] rounded-t-[32px] z-[120] p-8 pb-12 border-t border-white/10"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              <h2 className="text-2xl font-black text-center mb-2 text-white">Iniciar sesión en Kwai 2</h2>
              <p className="text-white/40 text-center text-sm mb-10">Gestiona tu cuenta, mira notificaciones, comenta videos y más.</p>
              
              <div className="space-y-3">
                {!isPhoneStep2 ? (
                  <>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={handleLogin}
                      className="w-full py-4 px-6 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        </div>
                        <span className="font-bold text-white">Continuar con Google</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                    </motion.button>

                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={handleFacebookLogin}
                      className="w-full py-4 px-6 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-[#1877F2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Facebook className="w-5 h-5 text-white fill-white" />
                        </div>
                        <span className="font-bold text-white">Continuar con Facebook</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                    </motion.button>

                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={handleAppleLogin}
                      className="w-full py-4 px-6 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Apple className="w-5 h-5 text-black fill-black" />
                        </div>
                        <span className="font-bold text-white">Continuar con Apple</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                    </motion.button>

                    <div className="relative py-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold"><span className="bg-[#121212] px-4 text-white/20">O usa tu teléfono</span></div>
                    </div>

                    <div className="flex space-x-2">
                      <div className="flex-1 border border-white/10 rounded-2xl flex items-center px-4 bg-white/5">
                        <Phone className="w-4 h-4 text-white/40 mr-2" />
                        <input 
                          type="tel" 
                          placeholder="+1 234 567 890" 
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-transparent py-4 text-sm outline-none text-white"
                        />
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={handlePhoneLogin}
                        className="bg-[#FE2C55] text-white px-6 rounded-2xl font-bold text-sm transition-transform"
                      >
                        Enviar
                      </motion.button>
                    </div>
                    <div id="recaptcha-container"></div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-2">Enviamos un código a</p>
                      <p className="font-bold">{phoneNumber}</p>
                    </div>
                    <div className="flex justify-center space-x-2">
                      <input 
                        type="text" 
                        maxLength={6}
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="w-full max-w-[200px] text-center text-2xl font-black tracking-[0.5em] py-4 border-b-2 border-[#FE2C55] outline-none"
                      />
                    </div>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={handleVerifyCode}
                      className="w-full py-4 bg-[#FE2C55] text-white rounded-2xl font-bold shadow-lg transition-transform"
                    >
                      Verificar y entrar
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => setIsPhoneStep2(false)}
                      className="w-full text-gray-400 text-sm font-bold"
                    >
                      Volver atrás
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Wallet Overlay */}
      <AnimatePresence>
        {isWalletOpen && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-0 bg-[#F8F9FA] z-[120] flex flex-col"
          >
            <div className="p-4 bg-white border-b flex items-center justify-between sticky top-0">
              <button onClick={() => setIsWalletOpen(false)} className="text-gray-800 p-2">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
              <h4 className="font-bold text-gray-800">Mi Billetera Kwai</h4>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* Balance Card */}
              <div className="bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-3xl p-8 shadow-xl mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-black">K</span>
                    </div>
                    <p className="text-black/60 text-xs font-bold uppercase tracking-wider">Saldo Total</p>
                  </div>
                  <h2 className="text-black font-black text-4xl mb-1">{kwaiGolds.toLocaleString()}</h2>
                  <p className="text-black/40 text-sm font-bold">Kwai Gold acumulados</p>
                  
                  <div className="mt-8 pt-6 border-t border-black/5 flex items-end justify-between">
                    <div>
                      <p className="text-black/60 text-[10px] font-bold uppercase mb-1">Equivalente en USD</p>
                      <p className="text-black font-black text-2xl">${(kwaiGolds / 10000).toFixed(2)}</p>
                    </div>
                    <div className="bg-black/10 px-3 py-1 rounded-full text-[10px] font-bold text-black/60">
                      10,000 K = $1.00
                    </div>
                  </div>
                </div>
              </div>

              {/* Withdrawal Options */}
              <h4 className="font-bold text-gray-800 mb-4 px-2">Métodos de Retiro</h4>
              <div className="space-y-3 mb-8">
                {[
                  { name: 'PayPal', icon: '🅿️', speed: 'Instantáneo' },
                  { name: 'Transferencia Bancaria', icon: '🏦', speed: '1-3 días hábiles' },
                  { name: 'Tarjeta de Regalo Amazon', icon: '📦', speed: 'Instantáneo' },
                ].map((method) => (
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ scale: 1.02 }}
                    key={method.name}
                    className="w-full bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between hover:border-[#FE2C55] transition-all group"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{method.icon}</div>
                      <div className="text-left">
                        <p className="font-bold text-gray-800 text-sm">{method.name}</p>
                        <p className="text-[10px] text-gray-400">{method.speed}</p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-[#FE2C55]/10 transition-colors">
                      <Plus className="w-4 h-4 text-gray-300 group-hover:text-[#FE2C55]" />
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Action Button */}
              <motion.button 
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={async () => {
                  if (kwaiGolds < 1000) {
                    setShowToast('Mínimo de retiro: 1,000 Kwai Gold 💰');
                    return;
                  }
                  
                  const amountToWithdraw = 1000;
                  setIsUploading(true); 
                  
                  await new Promise(r => setTimeout(r, 2000));
                  
                  setKwaiGolds(prev => prev - amountToWithdraw);
                  setIsUploading(false);
                  setShowToast(`¡Retiro de $${(amountToWithdraw/10000).toFixed(2)} solicitado con éxito! ✅`);
                  
                  if (currentUser) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    await updateDoc(userRef, {
                      kwaiGolds: increment(-amountToWithdraw)
                    });
                  }
                }}
                disabled={isUploading}
                className="w-full bg-black text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-black/10 transition-all disabled:opacity-50"
              >
                {isUploading ? 'Procesando...' : 'Retirar $0.10 (1,000 K)'}
              </motion.button>
              <p className="text-center text-[10px] text-gray-400 mt-4">
                Al retirar, aceptas nuestros términos y condiciones de monetización.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Simulation Overlay */}
      <AnimatePresence>
        {isLiveActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-[130] flex flex-col"
          >
            <video 
              autoPlay 
              loop 
              muted 
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-60"
              src="https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-dancing-9730-large.mp4"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
            
            <div className="relative z-10 p-4 flex flex-col h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 bg-black/20 backdrop-blur-md rounded-full pl-1 pr-3 py-1 border border-white/10">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=live" className="w-8 h-8 rounded-full bg-white/10" alt="live" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-white text-[10px] font-bold">@LiveGamer</p>
                    <p className="text-white/60 text-[8px]">{liveViewers.toLocaleString()} espectadores</p>
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.05 }}
                    className="bg-[#FE2C55] text-white px-3 py-1 rounded-full text-[8px] font-bold ml-2"
                  >
                    Seguir
                  </motion.button>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={() => setIsLiveActive(false)} 
                  className="text-white bg-black/20 p-2 rounded-full backdrop-blur-md"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </motion.button>
              </div>

              <div className="flex-1" />

              <div className="space-y-4 mb-4">
                <div className="h-40 overflow-y-auto space-y-2 no-scrollbar mask-fade-top">
                  {[
                    { user: 'Juan', msg: '¡Qué buen stream! 🔥' },
                    { user: 'Maria', msg: 'Salúdame por favor' },
                    { user: 'KwaiUser', msg: 'Enviando regalo 🎁' },
                    { user: 'Gamer99', msg: '¿Qué juego es ese?' },
                  ].map((chat, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <span className="text-yellow-400 font-bold text-[10px]">{chat.user}:</span>
                      <span className="text-white text-[10px]">{chat.msg}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-black/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-white/60 text-[10px]">
                    Di algo...
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    onClick={() => {
                      setKwaiGolds(prev => prev - 10);
                      setShowToast('¡Regalo enviado! 🎁');
                      setTimeout(() => setShowToast(null), 2000);
                    }}
                    className="w-10 h-10 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg animate-bounce"
                  >
                    <Sparkles className="w-6 h-6 text-black" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isShareOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareOpen(false)}
              className="absolute inset-0 bg-black/60 z-[250] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-white/10 rounded-t-3xl z-[260] p-8 pb-12 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              <h4 className="text-center font-bold mb-8 text-white text-lg">Compartir</h4>
              <div className="grid grid-cols-4 gap-y-8 mb-10">
                {[
                  { name: 'WhatsApp', color: 'bg-[#25D366]' },
                  { name: 'Facebook', color: 'bg-[#1877F2]' },
                  { name: 'Instagram', color: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]' },
                  { name: 'X', color: 'bg-black border border-white/10' },
                  { name: 'Telegram', color: 'bg-[#0088cc]' },
                  { name: 'Messenger', color: 'bg-[#006AFF]' },
                  { name: 'Snapchat', color: 'bg-[#FFFC00]' },
                  { name: 'Enlace', color: 'bg-white/10' }
                ].map((platform) => (
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    key={platform.name} 
                    onClick={() => handleShare(platform.name)}
                    className="flex flex-col items-center space-y-3 transition-transform"
                  >
                    <div className={`w-14 h-14 ${platform.color} rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform`}>
                      {platform.name === 'Enlace' ? (
                        <Link className="w-7 h-7 text-white" />
                      ) : (
                        <Share2 className={`w-7 h-7 ${platform.name === 'Snapchat' ? 'text-black' : 'text-white'}`} />
                      )}
                    </div>
                    <span className="text-[11px] text-white/60 font-medium">{platform.name}</span>
                  </motion.button>
                ))}
              </div>
              
              <motion.button 
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setIsShareOpen(false)}
                className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-bold transition-colors"
              >
                Cerrar
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 bg-black z-[200] flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => setIsNotificationsOpen(false)} 
                className="text-white"
              >
                <ArrowUpRight className="w-6 h-6 rotate-[225deg]" />
              </motion.button>
              <h2 className="text-white font-bold">Notificaciones</h2>
              <div className="w-6" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {[
                { id: 1, user: 'Juan Pérez', action: 'le gustó tu video', time: '2 min', avatar: 'https://picsum.photos/seed/juan/100' },
                { id: 2, user: 'María García', action: 'empezó a seguirte', time: '1h', avatar: 'https://picsum.photos/seed/maria/100' },
                { id: 3, user: 'Kwai Oficial', action: 'te envió un regalo', time: '5h', avatar: 'https://picsum.photos/seed/kwai/100' },
              ].map(notif => (
                <div key={notif.id} className="flex items-center space-x-4">
                  <img src={notif.avatar} className="w-12 h-12 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      <span className="font-bold">{notif.user}</span> {notif.action}
                    </p>
                    <p className="text-white/40 text-[10px]">{notif.time}</p>
                  </div>
                  <div className="w-10 h-10 bg-white/5 rounded-lg overflow-hidden">
                    <img src="https://picsum.photos/seed/thumb/100" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AIAssistant />

      {/* Kwai Gold Jackpot Animation */}
      <AnimatePresence>
        {showGoldAnim && (
          <motion.div 
            initial={{ scale: 0, opacity: 0, y: 100 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 1], y: 0 }}
            exit={{ scale: 0, opacity: 0, y: -100 }}
            className="fixed inset-0 flex items-center justify-center z-[300] pointer-events-none"
          >
            <div className="flex flex-col items-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-32 h-32 bg-yellow-400 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(250,204,21,0.5)]"
              >
                <Coins className="w-20 h-20 text-black" />
              </motion.div>
              <motion.h2 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="text-yellow-400 font-black text-4xl mt-6 drop-shadow-lg"
              >
                +500 GOLD!
              </motion.h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-xs font-bold z-[200] backdrop-blur-md"
          >
            {typeof showToast === 'string' ? showToast : showToast.message}
          </motion.div>
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>
  );
}
