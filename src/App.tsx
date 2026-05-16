/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Mic, RotateCcw, StopCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartoonFace } from './components/CartoonFace';
import { Waveform } from './components/Waveform';
import { ProgressBar } from './components/ProgressBar';
import { UserCV, AppStep, FaceEmotion, Vacancy } from './types';
import { VACANCIES } from './data/vacancies';
import { speak, processVoiceInput } from './services/gemini';
import { playAudioFromBase64, AudioRecorder, initAudioContext } from './services/audio';


const INITIAL_CV: UserCV = {
  name: "",
  age: null,
  location: "",
  education: "",
  skills: [],
  experience_years: null,
  job_type: "",
  preferred_location: "",
  expected_salary: "",
  phone: "",
  selected_vacancy: null,
  photo_taken: false
};


const STEPS: AppStep[] = [
  'GREETING', 'NAME', 'AGE', 'LOCATION', 'EDUCATION', 
  'SKILLS', 'EXPERIENCE', 'JOB_TYPE', 'PREFERRED_LOCATION', 'SALARY', 'PHONE',
  'MATCHING', 'VACANCY_SELECTION', 'CONFIRMATION', 'PHOTO', 'FAREWELL'
];

const STEP_LABELS: Record<AppStep, string> = {
  GREETING: "Salomlashish",
  NAME: "Ism so'ralmoqda",
  AGE: "Yosh so'ralmoqda",
  LOCATION: "Manzil so'ralmoqda",
  EDUCATION: "Ma'lumot so'ralmoqda",
  SKILLS: "Ko'nikmalar so'ralmoqda",
  EXPERIENCE: "Tajriba so'ralmoqda",
  JOB_TYPE: "Ish turi so'ralmoqda",
  PREFERRED_LOCATION: "Ish joyi so'ralmoqda",
  SALARY: "Maosh so'ralmoqda",
  PHONE: "Telefon so'ralmoqda",
  MATCHING: "Vakansiyalar qidirilmoqda",
  VACANCY_SELECTION: "Vakansiya tanlash",
  CONFIRMATION: "Tasdiqlash",
  PHOTO: "Suratga tushish",
  FAREWELL: "Xayrlashuv"
};

const STEP_QUESTIONS: Record<AppStep, string> = {
  GREETING: "Assalomu aleykum, bandlik vazirligiga xush kelibsiz! Men 'Ish Bor' xizmatining aqlli ovozli yordamchisiman. Bugun men sizga o'zingizga mos ish topishda yordam beraman. Boshlashga tayyormisiz?",
  NAME: "Juda yaxshi! Keling, tanishib olamiz. Ismingiz nima?",
  AGE: "[Name], tanishganimdan xursandman! Yoshingiz nechida?",
  LOCATION: "Tushunarli. Hozirda qaysi hududda istiqomat qilasiz?",
  EDUCATION: "Ma'lumotingiz haqida gapirib bering. Qayerda o'qigansiz?",
  SKILLS: "Sizda qanday kuchli ko'nikmalar bor? Nimalarni yaxshi bilasiz?",
  EXPERIENCE: "Siz tanlagan sohangizda necha yillik tajribaga egasiz?",
  JOB_TYPE: "Qanday lavozimda ishlashni xohlaysiz?",
  PREFERRED_LOCATION: "Qaysi hududda ishlashni afzal ko'rasiz?",
  SALARY: "Kutilayotgan oylik maoshingiz qancha bo'lishini xohlaysiz?",
  PHONE: "Siz bilan bog'lanish uchun telefon raqamingizni ayta olasizmi?",
  MATCHING: "Rahmat! Ma'lumotlaringizni tahlil qilyapman va sizga eng mos vakansiyalarni qidiryapman...",
  VACANCY_SELECTION: "Siz uchun mos vakansiyalar topildi. Qaysi biri sizga ko'proq yoqdi?",
  CONFIRMATION: "Ajoyib tanlov! Ushbu vakansiyaga arizangizni yuborishimni xohlaysizmi?",
  PHOTO: "[Name], xizmatimiz sizga yoqdimi? Agar ha bo'lsa — kameraga qarab jilmaying! Men sizning baxtli chehrangizni suratga olaman. Uch, ikki, bir...",
  FAREWELL: "[Name], bugun biz siz uchun [Job title] vakansiyasini topdik va arizangizni yubordik. [Company] tez orada siz bilan bog'lanadi. Omad tilayman! Xayr!"
};

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [cv, setCV] = useState<UserCV>(INITIAL_CV);
  const [emotion, setEmotion] = useState<FaceEmotion>('NEUTRAL');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'model', content: string }[]>([
    { role: 'model', content: "Assalomu aleykum! Men 'Ish Bor' yordamchisiman. Sizga qanday yordam bera olaman?" }
  ]);
  const [matches, setMatches] = useState<Vacancy[]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioCacheRef = useRef<Record<string, string>>({});

  const getQuestionText = (step: AppStep) => {
    return STEP_QUESTIONS[step]
      .replace("[Name]", cv.name || "Do'stim")
      .replace("[Job title]", cv.selected_vacancy?.title || "ish")
      .replace("[Company]", cv.selected_vacancy?.company || "Kompaniya");
  };

  useEffect(() => {
    // Pre-load audio for GREETING immediately
    const preLoadGreeting = async () => {
      const question = getQuestionText('GREETING');
      if (!audioCacheRef.current[question]) {
          try {
              console.log("Pre-loading greeting audio");
              const audio = await speak(question);
              audioCacheRef.current[question] = audio;
              console.log("Greeting audio pre-loaded");
          } catch(e) {
              console.error("Failed to pre-load greeting audio", e);
          }
      }
    };
    preLoadGreeting();
  }, []);

  const currentStep = STEPS[stepIndex];

  useEffect(() => {
    if (hasStarted) {
      (async () => {
        await startStep();
      })();
    }
  }, [hasStarted]);

  const startStep = async () => {
    const step = STEPS[stepIndex];

    // Auto-skip filled steps
    if (step === 'NAME' && cv.name) { setStepIndex(stepIndex + 1); return; }
    if (step === 'AGE' && cv.age) { setStepIndex(stepIndex + 1); return; }
    if (step === 'LOCATION' && cv.location) { setStepIndex(stepIndex + 1); return; }
    if (step === 'EDUCATION' && cv.education) { setStepIndex(stepIndex + 1); return; }
    if (step === 'SKILLS' && cv.skills.length > 0) { setStepIndex(stepIndex + 1); return; }
    if (step === 'EXPERIENCE' && cv.experience_years !== null) { setStepIndex(stepIndex + 1); return; }

    let question = getQuestionText(step);
    console.log(`Starting step ${step}: ${question}`);
    setSubtitle(question);

    setEmotion('HAPPY');
    setIsSpeaking(true);
    setIsAiLoading(true);
    
    try {
      let audio: string;
      if (audioCacheRef.current[question]) {
        audio = audioCacheRef.current[question];
        console.log(`Using cached audio for ${step}`);
      } else {
        console.log(`Generating audio for ${step}`);
        audio = await speak(question);
        audioCacheRef.current[question] = audio;
        console.log(`Audio generated for ${step}`);
      }
      setIsAiLoading(false);
      console.log(`Playing audio for ${step}`);
      await playAudioFromBase64(audio);
      console.log(`Audio finished for ${step}`);
    } catch (e) {
      console.warn("TTS Error during startStep:", e);
      setIsAiLoading(false);
      await new Promise(r => setTimeout(r, 1000));
    } finally {
      setIsSpeaking(false);
      setEmotion('NEUTRAL');
    }

    if (step === 'MATCHING') {
      await handleMatching();
    } else if (step === 'PHOTO') {
      await startCamera();
      startCountdown();
    } else if (step !== 'FAREWELL') {
      startListening();
    }

    // Pre-fetch next step audio
    if (stepIndex < STEPS.length - 1) {
      const nextStep = STEPS[stepIndex + 1];
      const nextQuestion = getQuestionText(nextStep);
      if (!audioCacheRef.current[nextQuestion]) {
        speak(nextQuestion).then(audio => {
          audioCacheRef.current[nextQuestion] = audio;
        }).catch(() => {});
      }
    }
  };

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (e) {
      console.error("Failed to get permissions", e);
    }
    initAudioContext();
    setHasStarted(true);
  };

  const startListening = async () => {
    setIsListening(true);
    setEmotion('LISTENING');
    await recorderRef.current.start();
    
    resetInactivityTimer();
  };

  const resetInactivityTimer = () => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      handleSilenceBrief();
    }, 12000);
  };

  const handleSilenceBrief = async () => {
    if (isListening && !isSpeaking) {
      setEmotion('CONFUSED');
      try {
        const audio = await speak("Siz hali o'ylamoqdasizmi? Shoshilmang.");
        await playAudioFromBase64(audio);
      } catch (e) {
        console.error("TTS error in handleSilenceBrief:", e);
      }
      setEmotion('LISTENING');
      resetLongInactivityTimer();
    }
  };

  const resetLongInactivityTimer = () => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      handleSilenceLong();
    }, 18000); 
  };

  const handleSilenceLong = async () => {
    if (isListening && !isSpeaking) {
      const audio = await speak("Agar vaqtingiz bo'lmasa, istalgan vaqt qaytib kelishingiz mumkin. Xayr!");
      try {
        await playAudioFromBase64(audio);
      } catch (e) {
        console.error("TTS error in handleSilenceLong:", e);
      }
      resetApp();
    }
  };

  const stopListeningAndProcess = async () => {
    if (isAiLoading) return;
    
    setIsListening(false);
    setEmotion('THINKING');
    setIsAiLoading(true);
    
    const audioBase64 = await recorderRef.current.stop();
    if (!audioBase64) {
      setIsAiLoading(false);
      setEmotion('NEUTRAL');
      return;
    }
    
    try {
      const result = await processVoiceInput(audioBase64, conversationHistory, cv);
      setIsAiLoading(false);

      setCV(result.updatedCV);
      setConversationHistory(prev => [...prev, { role: 'user', content: '...' }, { role: 'model', content: result.response }]);
      setSubtitle(result.response);
      setEmotion('HAPPY');
      
      const audio = await speak(result.response);
      setIsSpeaking(true);
      await playAudioFromBase64(audio);
      setIsSpeaking(false);
      setEmotion('NEUTRAL');

      startListening();
      
    } catch (e) {
      console.error(e);
      setIsAiLoading(false);
      setEmotion('CONFUSED');
      const audio = await speak("Tushuna olmadim. Qaytarib ayta olasizmi?");
      await playAudioFromBase64(audio);
      startListening();
    }
  };

  const handleMatching = async () => {
    setEmotion('THINKING');
    // Scoring logic
    const scoredVacancies = VACANCIES.map(v => {
      let score = 0;
      // Skill points
      cv.skills.forEach(skill => {
        if (v.skills.some(vs => vs.toLowerCase().includes(skill.toLowerCase()))) score += 3;
      });
      // Region points
      if (v.region.toLowerCase() === cv.preferred_location.toLowerCase()) score += 2;
      // Salary points - more complex, but simplified for demo
      score += 1; 

      return { ...v, score };
    }).sort((a, b) => b.score - a.score);

    const topMatches = scoredVacancies.slice(0, 3);
    setMatches(topMatches);
    
    setTimeout(() => {
      setStepIndex(STEPS.indexOf('VACANCY_SELECTION'));
    }, 2000);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      console.error("Camera error:", e);
    }
  };

  const startCountdown = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(interval);
          capturePhoto();
          return null;
        }
        return (prev || 0) - 1;
      });
    }, 1000);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedPhoto(dataUrl);
      setCV({ ...cv, photo_taken: true });
      
      // Stop camera
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      
      handlePhotoSuccess();
    }
  };

  const handlePhotoSuccess = async () => {
    setEmotion('CELEBRATING');
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
    const audio = await speak("Rahmat! Siz juda chiroyli jilmaydingiz!");
    await playAudioFromBase64(audio);
    setStepIndex(STEPS.indexOf('FAREWELL'));
  };

  const resetApp = () => {
    setStepIndex(0);
    setCV(INITIAL_CV);
    setMatches([]);
    setCapturedPhoto(null);
    setHasStarted(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-between p-6 font-sans">
      {!hasStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md text-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-48 h-48 bg-yellow-400 rounded-full flex items-center justify-center shadow-glow"
          >
            <CartoonFace emotion="HAPPY" />
          </motion.div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-slate-800">Ish Bor!</h1>
            <p className="text-slate-500">O'zbekistondagi birinchi AI ovozli ish qidirish yordamchisi.</p>
            <button 
              onClick={handleStart}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95 text-lg"
            >
              Gaplashishni boshlash
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="w-full max-w-2xl flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-yellow-600 flex items-center gap-2">
            <Mic className="text-yellow-500" /> Ish Bor AI
          </h1>
          <div className="flex gap-2">
            {stepIndex > 0 && stepIndex < STEPS.length - 1 && (
              <button 
                onClick={() => setStepIndex(prev => prev - 1)}
                className="p-2 rounded-full hover:bg-gray-200"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <button onClick={resetApp} className="p-2 rounded-full hover:bg-gray-200">
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
        <ProgressBar currentStep={stepIndex + 1} totalSteps={STEPS.length} />
        <p className="text-xs text-gray-400 font-mono text-center">
          {STEP_LABELS[currentStep]}...
        </p>
      </header>

      {/* Main interaction */}
      <main className="flex-1 w-full max-w-2xl flex flex-col items-center justify-center gap-8 py-12">
        <AnimatePresence mode="wait">
          {currentStep === 'PHOTO' && !capturedPhoto ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl"
            >
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <motion.span 
                    key={countdown}
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-8xl font-black text-white drop-shadow-lg"
                  >
                    {countdown}
                  </motion.span>
                </div>
              )}
            </motion.div>
          ) : capturedPhoto ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white"
            >
              <img src={capturedPhoto} className="w-full h-full object-cover" alt="Smile" />
            </motion.div>
          ) : (
            <CartoonFace emotion={emotion} />
          )}
        </AnimatePresence>

        <div className="w-full text-center space-y-4">
          <AnimatePresence mode="wait">
            {isAiLoading || isSpeaking || isListening ? (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                key="active-state"
                className="space-y-4"
              >
                <div className="text-yellow-600 font-medium leading-relaxed px-4">
                  {isAiLoading ? "O'ylayapman..." : (isSpeaking ? subtitle : (isListening ? "Sizni tinglayapman..." : ""))}
                </div>
                <Waveform isListening={true} />
                <button 
                  onClick={() => {
                    if (isSpeaking) {
                      setIsSpeaking(false);
                    }
                    if (isListening) {
                        stopListeningAndProcess();
                    } else {
                        startListening();
                    }
                  }}
                  className={`${isListening ? 'bg-green-500 px-8' : 'bg-yellow-500 w-16 h-16'} hover:bg-opacity-90 text-white rounded-full flex items-center justify-center shadow-lg mx-auto transition-transform hover:scale-110 active:scale-95 mt-4 font-bold`}
                >
                  {isListening ? "Gapirib bo'ldim" : <Mic />}
                </button>
                {isListening && (
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest animate-pulse">Sukunat kutilmoqda...</p>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                key="idle-state"
                className="h-28 flex flex-col justify-center gap-4"
              >
                {stepIndex === STEPS.length - 1 ? (
                  <div className="flex flex-col gap-6 items-center">
                    <div className="text-xl font-medium text-gray-700 italic">"Xayr! Omad tilayman!"</div>
                    <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 text-left border border-gray-100 flex flex-col gap-4">
                      <div className="flex gap-4 items-center">
                        {capturedPhoto && <img src={capturedPhoto} className="w-20 h-20 rounded-2xl object-cover border-2 border-yellow-400" />}
                        <div>
                          <h3 className="font-bold text-lg">{cv.name || "Noma'lum"}</h3>
                          <p className="text-gray-500 text-sm">{cv.job_type} | {cv.age} yosh</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                        <div className="text-gray-400">MANZIL: <span className="text-gray-800 block">{cv.location}</span></div>
                        <div className="text-gray-400">MA'LUMOT: <span className="text-gray-800 block">{cv.education}</span></div>
                        <div className="text-gray-400">KO'NIKMALAR: <span className="text-gray-800 block">{cv.skills.join(', ')}</span></div>
                        <div className="text-gray-400">LOYIHA: <span className="text-gray-800 block">{cv.selected_vacancy?.title}</span></div>
                      </div>
                      <div className="pt-4 border-t border-dashed flex justify-between items-center">
                        <div className="text-green-600 font-bold flex items-center gap-1 text-sm"><CheckCircle2 size={16}/> ARIZA YUBORILDI</div>
                        <div className="text-gray-400 text-[10px] tracking-widest uppercase">ID: {Math.random().toString(36).substr(2, 9)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-500 italic">Mening savolimga javob bering...</div>
                    {(currentStep !== 'PHOTO' && currentStep !== 'MATCHING') && (
                      <button 
                        onClick={startListening}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg mx-auto transition-transform hover:scale-110 active:scale-95"
                      >
                        <Mic />
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Display matches only during selection */}
        {(currentStep === 'VACANCY_SELECTION' || currentStep === 'CONFIRMATION') && (
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full grid grid-cols-1 md:grid-cols-3 gap-4"
           >
             {matches.map((v) => (
               <div 
                key={v.id}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${cv.selected_vacancy?.id === v.id ? 'border-yellow-500 bg-yellow-50 shadow-md' : 'border-gray-100 bg-white hover:border-yellow-200'}`}
                onClick={() => setCV({...cv, selected_vacancy: v})}
               >
                 <div className="text-xs text-yellow-600 font-bold uppercase mb-1">{v.company}</div>
                 <div className="font-bold text-gray-900 mb-2">{v.title}</div>
                 <div className="flex items-center gap-1 text-xs text-gray-500">
                   <span>📍 {v.region}</span>
                 </div>
                 <div className="mt-3 text-sm font-bold text-gray-800">{v.salary} so'm</div>
               </div>
             ))}
           </motion.div>
        )}
      </main>
    </>
    )}
      {/* Footer Info */}
      <footer className="w-full max-w-2xl text-center text-xs text-gray-400 mt-8 flex flex-col gap-2">
        <div className="flex justify-center gap-4">
          <div className="flex items-center gap-1">
            <CheckCircle2 size={12} className={cv.name ? "text-green-500" : ""} /> Ism
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 size={12} className={cv.skills.length > 0 ? "text-green-500" : ""} /> Ko'nikmalar
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 size={12} className={cv.phone ? "text-green-500" : ""} /> Aloqa
          </div>
        </div>
        <p>© 2026 Ish Bor AI. O'zbekiston bo'ylab ish qidirish tizimi.</p>
      </footer>
    </div>
  );
}

