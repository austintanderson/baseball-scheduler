import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, MapPin, Settings, ChevronRight, Plus, Trash2, AlertCircle, 
  CheckCircle, Shield, UserCheck, Download, Clock, CalendarCheck, Share, Save, 
  FolderOpen, Search, Printer, WifiOff, FileText, Trophy, ArrowRight, ArrowLeft,
  ClipboardList, XCircle
} from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';

let app, auth, db, appId, rawAppId;
try {
  // 👇 REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT CONFIGURATION 👇
  const manualFirebaseConfig = {
    // Pulling from environment variables to prevent GitHub plaintext secret alerts
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: "baseball-scheduler-af4f5.firebaseapp.com",
    projectId: "baseball-scheduler-af4f5",
    storageBucket: "baseball-scheduler-af4f5.firebasestorage.app",
    messagingSenderId: "19278883081",
    appId: "1:19278883081:web:927965acfa281acf634bd8",
    measurementId: "G-CJG0DCT3MP"
};


  // Fallback for the AI environment preview (so it doesn't crash while you are editing)
  const envConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
  const isUsingManualConfig = manualFirebaseConfig.apiKey !== "YOUR_API_KEY";
  const finalConfig = isUsingManualConfig ? manualFirebaseConfig : envConfig;

  app = initializeApp(finalConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Sets the root database path. If using your own config, it defaults to 'my-league-app'
  rawAppId = (typeof __app_id !== 'undefined' && !isUsingManualConfig) ? __app_id : 'my-league-app';
  appId = String(rawAppId).replace(/\//g, '_');
  
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// --- Local Storage Abstraction (For the Scheduler) ---
const storage = {
  KEY: 'baseball_schedules',
  loadAll: function() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load local saves", e);
      return [];
    }
  },
  save: function(data) {
    const saves = this.loadAll();
    const newSave = { ...data, id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
    saves.unshift(newSave);
    localStorage.setItem(this.KEY, JSON.stringify(saves));
    return newSave;
  },
  delete: function(id) {
    const saves = this.loadAll().filter(s => s.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(saves));
  }
};

// --- Helper Functions ---
const timeToMins = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const generateDates = (start, end, blackoutPeriods, weeklySchedule) => {
  if (!start || !end) return [];
  
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  current.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);
  
  const normalizedBlackouts = (blackoutPeriods || []).map(p => {
    const s = new Date(p.start);
    const e = new Date(p.end);
    s.setHours(0,0,0,0);
    e.setHours(0,0,0,0);
    return { start: s, end: e };
  });

  while (current <= endDate) {
    const day = current.getDay(); 
    const scheduleForDay = weeklySchedule && weeklySchedule[day];

    let isBlackout = false;
    for (const period of normalizedBlackouts) {
      if (period.start && period.end && !isNaN(period.start) && !isNaN(period.end)) {
         if (current >= period.start && current <= period.end) {
             isBlackout = true;
             break;
         }
      }
    }

    if (scheduleForDay && scheduleForDay.active && !isBlackout) {
      const slots = scheduleForDay.times
        .split(',')
        .map(t => t.trim())
        .filter(t => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t))
        .sort();

      if (slots.length > 0) {
        dates.push({
          dateStr: current.toISOString().split('T')[0],
          dateObj: new Date(current), 
          dayOfWeek: day, 
          displayDate: current.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          slots: slots
        });
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const getWeekIdentifier = (dateObj) => {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-${weekNo}`;
};

// --- Components ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className} print:shadow-none print:border-0`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = 'primary', disabled = false, className = '', fullWidth = false, type = 'button' }) => {
  const baseStyle = "px-4 py-3 md:py-2 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 touch-manipulation print:hidden";
  const widthStyle = fullWidth ? "w-full" : "";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm shadow-blue-200",
    secondary: "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${widthStyle} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, className = "", ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-sm font-semibold text-slate-600 ml-1">{label}</label>}
    <input
      className={`w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base shadow-sm appearance-none disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
      {...props}
    />
  </div>
);

// --- Main Application ---
export default function App() {
  // App Mode State: 'loading' -> 'landing' -> 'scheduler' | 'derby'
  const [appMode, setAppMode] = useState('loading');
  
  // Firebase State
  const [user, setUser] = useState(null);
  const [derbySignups, setDerbySignups] = useState([]);

  // Scheduler State
  const [activeTab, setActiveTab] = useState('setup');
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [seasonConfig, setSeasonConfig] = useState({ startDate: '', endDate: '', blackoutPeriods: [] });
  const defaultWeeklySchedule = {
    0: { active: false, times: '' }, 1: { active: false, times: '' }, 2: { active: false, times: '' },
    3: { active: false, times: '' }, 4: { active: false, times: '' }, 5: { active: false, times: '' },
    6: { active: false, times: '' }
  };
  const [weeklySchedule, setWeeklySchedule] = useState(defaultWeeklySchedule);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [ageGroups, setAgeGroups] = useState([]);
  const [fields, setFields] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduleStats, setScheduleStats] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  const [externalConflicts, setExternalConflicts] = useState([]);

  // Derby Form State
  const [derbyForm, setDerbyForm] = useState({
    ageGroup: '',
    playerName: '',
    nickname: '',
    teamName: '',
    email: ''
  });
  
  // Submit state now holds an object: { status: 'success'|'waitlist'|'error', cancelCode?: '...' }
  const [derbySubmitState, setDerbySubmitState] = useState(null); 
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelCodeInput, setCancelCodeInput] = useState('');
  const [cancelStatus, setCancelStatus] = useState(null);

  // --- Initialization Effects ---
  useEffect(() => {
    // Splash screen timer
    const timer = setTimeout(() => setAppMode('landing'), 1500);
    
    // Load local saves for scheduler
    setSavedSchedules(storage.loadAll());

    return () => clearTimeout(timer);
  }, []);

  // Firebase Auth Effect
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth error:", e);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Firebase Data Fetch Effect (For Derby Signups)
  useEffect(() => {
    if (!user || !db || !appId) return;
    
    try {
      // Listen to all public derby signups to maintain an accurate count
      const signupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'derby_signups');
      const unsubscribe = onSnapshot(signupsRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDerbySignups(data);
      }, (error) => {
        console.error("Firestore snapshot error:", error);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to initialize Firestore listener:", error);
    }
  }, [user]);

  // Teams Sync (Scheduler)
  useEffect(() => {
    let newTeams = [];
    let hasChanges = false;
    ageGroups.forEach(group => {
      const existingGroupTeams = teams.filter(t => t.groupId === group.id);
      const count = Number(group.teamsCount) || 0;
      
      for (let i = 0; i < count; i++) {
        if (existingGroupTeams[i]) {
          newTeams.push(existingGroupTeams[i]);
        } else {
          hasChanges = true;
          newTeams.push({
            id: `${group.id}-t${i+1}`,
            groupId: group.id,
            name: `${group.name} Team ${i+1}`,
            headCoachId: '',
            asstCoachId: ''
          });
        }
      }
    });
    if (newTeams.length !== teams.length || hasChanges) {
       setTeams(newTeams);
    }
  }, [ageGroups]);

  // --- Derby Handlers ---
  const handleDerbySubmit = async (e) => {
    e.preventDefault();
    if (!user || !db || !appId) {
      alert("Database connection not ready. Please try again.");
      return;
    }
    setDerbySubmitState({ status: 'submitting' });

    try {
      // 1. Calculate how many signups already exist for this age group
      const existingCount = derbySignups.filter(s => s.ageGroup === derbyForm.ageGroup && s.status === 'registered').length;
      
      // 2. Determine status (40 participant limit)
      const isWaitlist = existingCount >= 40;
      const finalStatus = isWaitlist ? 'waitlist' : 'registered';

      // 3. Generate a unique cancellation code
      const generatedCancelCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 4. Save to Firestore (Public Collection)
      const signupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'derby_signups');
      await addDoc(signupsRef, {
        ...derbyForm,
        status: finalStatus, // This explicitly saves "registered" or "waitlist" in your DB
        cancelCode: generatedCancelCode,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      setDerbySubmitState({ 
        status: isWaitlist ? 'waitlist' : 'success', 
        cancelCode: generatedCancelCode 
      });
      setDerbyForm({ ageGroup: '', playerName: '', nickname: '', teamName: '', email: '' });
    } catch (error) {
      console.error("Submission failed:", error);
      setDerbySubmitState({ status: 'error' });
    }
  };

  const handleCancelSpot = async (e) => {
    e.preventDefault();
    if (!user || !db || !appId) return;
    setCancelStatus('processing');

    try {
      // Find the document with the matching cancel code
      const targetSignup = derbySignups.find(s => s.cancelCode === cancelCodeInput.trim().toUpperCase());
      
      if (!targetSignup) {
        setCancelStatus('invalid');
        return;
      }

      // Delete the user's registration
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'derby_signups', targetSignup.id));

      // ONLY bump the waitlist if the cancelled user was 'registered'
      if (targetSignup.status === 'registered') {
        // Find the oldest waitlisted person in the SAME age group
        const waitlisted = derbySignups
          .filter(s => s.ageGroup === targetSignup.ageGroup && s.status === 'waitlist' && s.id !== targetSignup.id)
          .sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeA - timeB;
          });

        if (waitlisted.length > 0) {
          const nextInLine = waitlisted[0];
          // Update their status to registered
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'derby_signups', nextInLine.id), {
            status: 'registered'
          });
        }
      }

      setCancelStatus('success');
      setCancelCodeInput('');
      setTimeout(() => {
        setIsCancelling(false);
        setCancelStatus(null);
      }, 3000);

    } catch (error) {
      console.error("Cancellation failed:", error);
      setCancelStatus('error');
    }
  };

  // --- Scheduler Handlers ---
  const saveSchedule = async () => {
    const name = prompt("Enter a name for this save:", `Schedule ${new Date().toLocaleDateString()}`);
    if (!name) return;

    const data = { name, seasonConfig, weeklySchedule, ageGroups, fields, coaches, teams, schedule, scheduleStats, externalConflicts };
    try {
      storage.save(data);
      setSavedSchedules(storage.loadAll());
      alert("Saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Error saving.");
    }
  };

  const loadSchedule = (save) => {
    if (!confirm("Load this schedule? Unsaved changes will be lost.")) return;
    
    const config = save.seasonConfig || {};
    if (config.blackoutStart && (!config.blackoutPeriods || config.blackoutPeriods.length === 0)) {
        config.blackoutPeriods = [{ id: Date.now(), start: config.blackoutStart, end: config.blackoutEnd }];
    }
    if (!config.blackoutPeriods) config.blackoutPeriods = [];

    setSeasonConfig(config);
    setWeeklySchedule({ ...defaultWeeklySchedule, ...(save.weeklySchedule || {}) });
    
    const migratedGroups = (save.ageGroups || []).map(g => ({
        ...g,
        maxWeekday: g.maxWeekday !== undefined ? g.maxWeekday : 1,
        maxWeekend: g.maxWeekend !== undefined ? g.maxWeekend : 2
    }));
    setAgeGroups(migratedGroups);

    setFields(save.fields || []);
    setCoaches(save.coaches || []);
    setTeams(save.teams || []);
    setSchedule(save.schedule || []);
    setScheduleStats(save.scheduleStats || null);
    setExternalConflicts(save.externalConflicts || []);
    setActiveTab('schedule');
  };

  const deleteSchedule = async (id) => {
    if (!confirm("Are you sure?")) return;
    storage.delete(id);
    setSavedSchedules(storage.loadAll());
  };

  const handleUpdateTeamCoach = (teamId, field, coachId) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, [field]: coachId } : t));
  };

  const toggleFieldAllowance = (fieldId, groupId) => {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f;
      const newAllowed = f.allowedGroups.includes(groupId)
        ? f.allowedGroups.filter(g => g !== groupId)
        : [...f.allowedGroups, groupId];
      return { ...f, allowedGroups: newAllowed };
    }));
  };

  const toggleDayActive = (dayIndex) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayIndex]: { ...prev[dayIndex], active: !prev[dayIndex].active }
    }));
  };

  const updateDayTimes = (dayIndex, newTimes) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayIndex]: { ...prev[dayIndex], times: newTimes }
    }));
  };
  
  const parseConflicts = (csvText) => {
    const lines = csvText.split('\n');
    const conflicts = [];
    lines.forEach(line => {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 4) {
        const [date, time, duration, coachName] = parts;
        const coach = coaches.find(c => c.name.toLowerCase() === coachName.toLowerCase());
        if (coach) {
          conflicts.push({
            dateStr: date,
            timeStr: time,
            duration: parseInt(duration) || 90,
            coachId: coach.id,
            coachName: coach.name
          });
        }
      }
    });
    setExternalConflicts(conflicts);
  };

  const shareFile = async (filename, content, mimeType) => {
    const file = new File([content], filename, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (error) { console.log('Share aborted', error); }
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToGameChanger = (groupId = null) => {
    const gamesToExport = groupId ? schedule.filter(g => g.groupId === groupId) : schedule;
    if (gamesToExport.length === 0) { alert("No games to export."); return; }
    
    const headers = ["Date", "Start Time", "End Time", "Location", "Home Team", "Away Team"];
    const rows = gamesToExport.map(game => {
      const [year, month, day] = game.dateStr.split('-').map(Number);
      const [hours, mins] = game.time.split(':').map(Number);
      const startDateObj = new Date(year, month - 1, day, hours, mins);
      const group = ageGroups.find(g => g.id === game.groupId);
      const duration = group ? Number(group.duration) : 90;
      const endDateObj = new Date(startDateObj.getTime() + duration*60000);
      const formatTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return [ startDateObj.toLocaleDateString('en-US'), formatTime(startDateObj), formatTime(endDateObj), game.fieldName, game.teamA.name, game.teamB.name ];
    });
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const filename = groupId ? `schedule_${ageGroups.find(g => g.id === groupId)?.name.replace(/\s+/g, '_')}.csv` : 'full_schedule.csv';
    shareFile(filename, csvContent, 'text/csv;charset=utf-8');
  };

  const exportToICS = () => {
    if (schedule.length === 0) { alert("No schedule."); return; }
    const formatICSDate = (dateStr, timeStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const pad = (n) => n < 10 ? '0' + n : n;
      return `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
    };
    const formatICSEndDate = (dateStr, timeStr, durationMins) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const d = new Date(year, month - 1, day, hour, minute);
      d.setMinutes(d.getMinutes() + durationMins);
      const pad = (n) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    };
    let icsContent = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LeagueSchedulerPro//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    schedule.forEach((game, index) => {
      const group = ageGroups.find(g => g.id === game.groupId);
      const duration = group ? Number(group.duration) : 90;
      const headCoachA = coaches.find(c => c.id === game.teamA.headCoachId)?.name || 'TBD';
      const headCoachB = coaches.find(c => c.id === game.teamB.headCoachId)?.name || 'TBD';
      icsContent.push("BEGIN:VEVENT", `UID:${game.id}-${index}@leaguescheduler.pro`, `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').split('Z')[0]}Z`, `DTSTART:${formatICSDate(game.dateStr, game.time)}`, `DTEND:${formatICSEndDate(game.dateStr, game.time, duration)}`, `SUMMARY:${game.teamA.name} vs ${game.teamB.name}`, `LOCATION:${game.fieldName}`, `DESCRIPTION:Division: ${group?.name || ''}\\nHome: ${game.teamA.name} (${headCoachA})\\nAway: ${game.teamB.name} (${headCoachB})`, "STATUS:CONFIRMED", "END:VEVENT");
    });
    icsContent.push("END:VCALENDAR");
    shareFile('league_schedule.ics', icsContent.join('\r\n'), 'text/calendar;charset=utf-8');
  };

  // --- Algorithm ---
  const generateSchedule = async () => {
    setIsGenerating(true);
    setSchedule([]);
    setScheduleStats(null);
    setTimeout(() => {
      try {
        const result = runSchedulingAlgorithm();
        setSchedule(result.games);
        setScheduleStats(result.stats);
        setActiveTab('schedule');
      } catch (e) {
        alert(e.message);
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  };

  const runSchedulingAlgorithm = () => {
    if (!seasonConfig.startDate || !seasonConfig.endDate) throw new Error("Set Season Start/End dates.");
    
    const calendarDays = generateDates(
      seasonConfig.startDate, 
      seasonConfig.endDate, 
      seasonConfig.blackoutPeriods, 
      weeklySchedule 
    );
    
    if (calendarDays.length === 0) throw new Error("No valid dates found.");
    
    let allGames = [], gameIdCounter = 1;
    
    ageGroups.forEach(group => {
      const groupTeams = teams.filter(t => t.groupId === group.id);
      if (groupTeams.length < 2) return;

      const gamesNeeded = Number(group.gamesPerTeam) || 0;
      const teamIndices = groupTeams.map((_, i) => i);
      if (teamIndices.length % 2 !== 0) teamIndices.push(-1); 
      
      const n = teamIndices.length;
      const numRounds = n - 1;
      const half = n / 2;
      const rounds = [];

      for (let r = 0; r < numRounds; r++) {
        const round = [];
        for (let i = 0; i < half; i++) {
          const t1 = teamIndices[i];
          const t2 = teamIndices[n - 1 - i];
          if (t1 !== -1 && t2 !== -1) {
             round.push({ teamA: groupTeams[t1], teamB: groupTeams[t2] });
          }
        }
        rounds.push(round);
        teamIndices.splice(1, 0, teamIndices.pop());
      }

      let finalMatchups = [];
      if (rounds.length > 0) {
        for (let i = 0; i < gamesNeeded; i++) {
           const r = rounds[i % rounds.length];
           const cycle = Math.floor(i / rounds.length) + 1;
           
           if (r) {
             r.forEach(match => {
                finalMatchups.push({
                   id: `g-${gameIdCounter++}`, 
                   groupId: group.id, 
                   teamA: match.teamA, 
                   teamB: match.teamB,
                   cycle: cycle
                });
             });
           }
        }
      }
      allGames = [...allGames, ...finalMatchups];
    });
    
    allGames.sort(() => Math.random() - 0.5);
    
    const scheduledGames = [];
    const pendingGames = [...allGames];
    
    const teamDailyGames = {};
    const teamWeeklyGames = {};
    const teamWeeklyWeekdayGames = {};
    const teamWeeklyWeekendGames = {};
    const teamBusyTimes = {}; 
    const matchupSides = {};
    const teamHomeCounts = {};
    const coachIntervals = {}; 
    const GAP_BUFFER_MINS = 30;
    
    const teamGamesLeft = {};
    allGames.forEach(g => {
        teamGamesLeft[g.teamA.id] = (teamGamesLeft[g.teamA.id] || 0) + 1;
        teamGamesLeft[g.teamB.id] = (teamGamesLeft[g.teamB.id] || 0) + 1;
    });

    externalConflicts.forEach(conf => {
      const start = timeToMins(conf.timeStr);
      const end = start + conf.duration;
      const key = `${conf.dateStr}|${conf.coachId}`;
      if (!coachIntervals[key]) coachIntervals[key] = [];
      coachIntervals[key].push({ start, end });
    });

    const hasCoachConflict = (teamA, teamB, dateStr, timeStr, gameDurationMins) => {
      const coachesToCheck = [teamA.headCoachId, teamA.asstCoachId, teamB.headCoachId, teamB.asstCoachId].filter(Boolean);
      const gameStart = timeToMins(timeStr);
      const gameEnd = gameStart + gameDurationMins;
      for (let coachId of coachesToCheck) {
        const key = `${dateStr}|${coachId}`;
        const existing = coachIntervals[key] || [];
        for (let interval of existing) {
          if ((interval.end + GAP_BUFFER_MINS > gameStart) && (gameEnd + GAP_BUFFER_MINS > interval.start)) return true;
        }
      }
      return false;
    };

    const addCoachInterval = (coachId, dateStr, startMins, endMins) => {
      const key = `${dateStr}|${coachId}`;
      if (!coachIntervals[key]) coachIntervals[key] = [];
      coachIntervals[key].push({ start: startMins, end: endMins });
    };

    for (const day of calendarDays) {
        const weekId = getWeekIdentifier(day.dateObj);
        const isWeekday = day.dayOfWeek >= 1 && day.dayOfWeek <= 5;

        for (const time of day.slots) {
            const gameStart = timeToMins(time);

            for (const field of fields) {
                const teamMinCycle = {};
                for (const g of pendingGames) {
                    teamMinCycle[g.teamA.id] = Math.min(teamMinCycle[g.teamA.id] || 999, g.cycle);
                    teamMinCycle[g.teamB.id] = Math.min(teamMinCycle[g.teamB.id] || 999, g.cycle);
                }

                let bestGameIndex = -1;
                
                for (let pass = 1; pass <= 3; pass++) {
                    let maxWeight = -1;

                    for (let i = 0; i < pendingGames.length; i++) {
                        const game = pendingGames[i];
                        const group = ageGroups.find(g => g.id === game.groupId);
                        const durationMins = Number(group.duration) || 90;

                        if (!field.allowedGroups.includes(game.groupId)) continue; 
                        if (teamBusyTimes[`${day.dateStr}|${time}|${game.teamA.id}`]) continue; 
                        if (teamBusyTimes[`${day.dateStr}|${time}|${game.teamB.id}`]) continue; 
                        if (hasCoachConflict(game.teamA, game.teamB, day.dateStr, time, durationMins)) continue;

                        if (game.cycle > teamMinCycle[game.teamA.id] || game.cycle > teamMinCycle[game.teamB.id]) {
                            continue; 
                        }

                        if (pass <= 2) {
                            if ((teamDailyGames[`${day.dateStr}|${game.teamA.id}`] || 0) >= 1) continue;
                            if ((teamDailyGames[`${day.dateStr}|${game.teamB.id}`] || 0) >= 1) continue;
                        }

                        if (pass === 1) {
                            const maxWk = Number(group.gamesPerWeek) || 2;
                            if ((teamWeeklyGames[`${weekId}|${game.teamA.id}`] || 0) >= maxWk) continue;
                            if ((teamWeeklyGames[`${weekId}|${game.teamB.id}`] || 0) >= maxWk) continue;

                            const limitWeekday = Number(group.maxWeekday) !== undefined ? Number(group.maxWeekday) : 1;
                            const limitWeekend = Number(group.maxWeekend) !== undefined ? Number(group.maxWeekend) : 2;
                            if (isWeekday) {
                                if ((teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] || 0) >= limitWeekday) continue;
                                if ((teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] || 0) >= limitWeekday) continue;
                            } else {
                                if ((teamWeeklyWeekendGames[`${weekId}|${game.teamA.id}`] || 0) >= limitWeekend) continue;
                                if ((teamWeeklyWeekendGames[`${weekId}|${game.teamB.id}`] || 0) >= limitWeekend) continue;
                            }
                        }

                        const weight = (teamGamesLeft[game.teamA.id] || 0) + (teamGamesLeft[game.teamB.id] || 0);
                        
                        if (weight > maxWeight) {
                            maxWeight = weight;
                            bestGameIndex = i;
                        }
                    }
                    if (bestGameIndex !== -1) break;
                }

                if (bestGameIndex !== -1) {
                    const game = pendingGames[bestGameIndex];
                    const group = ageGroups.find(g => g.id === game.groupId);
                    const durationMins = Number(group.duration) || 90;

                    const tIds = [game.teamA.id, game.teamB.id].sort();
                    const mKey = `${tIds[0]}|${tIds[1]}`;
                    
                    let homeTeam, awayTeam;
                    const lastHomeId = matchupSides[mKey];
                    
                    if (lastHomeId) {
                        if (lastHomeId === game.teamA.id) { homeTeam = game.teamB; awayTeam = game.teamA; }
                        else { homeTeam = game.teamA; awayTeam = game.teamB; }
                    } else {
                        const c1 = teamHomeCounts[game.teamA.id] || 0;
                        const c2 = teamHomeCounts[game.teamB.id] || 0;
                        if (c1 < c2) { homeTeam = game.teamA; awayTeam = game.teamB; }
                        else if (c2 < c1) { homeTeam = game.teamB; awayTeam = game.teamA; }
                        else {
                            if (Math.random() > 0.5) { homeTeam = game.teamA; awayTeam = game.teamB; }
                            else { homeTeam = game.teamB; awayTeam = game.teamA; }
                        }
                    }
                    
                    matchupSides[mKey] = homeTeam.id;
                    teamHomeCounts[homeTeam.id] = (teamHomeCounts[homeTeam.id] || 0) + 1;

                    scheduledGames.push({ 
                        ...game, 
                        teamA: homeTeam,
                        teamB: awayTeam, 
                        dateStr: day.dateStr, 
                        displayDate: day.displayDate, 
                        time, 
                        fieldId: field.id, 
                        fieldName: field.name 
                    });

                    teamBusyTimes[`${day.dateStr}|${time}|${game.teamA.id}`] = true;
                    teamBusyTimes[`${day.dateStr}|${time}|${game.teamB.id}`] = true;

                    teamDailyGames[`${day.dateStr}|${game.teamA.id}`] = (teamDailyGames[`${day.dateStr}|${game.teamA.id}`] || 0) + 1;
                    teamDailyGames[`${day.dateStr}|${game.teamB.id}`] = (teamDailyGames[`${day.dateStr}|${game.teamB.id}`] || 0) + 1;
                    
                    teamWeeklyGames[`${weekId}|${game.teamA.id}`] = (teamWeeklyGames[`${weekId}|${game.teamA.id}`] || 0) + 1;
                    teamWeeklyGames[`${weekId}|${game.teamB.id}`] = (teamWeeklyGames[`${weekId}|${game.teamB.id}`] || 0) + 1;
                    
                    if (isWeekday) {
                        teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] = (teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] || 0) + 1;
                        teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] = (teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] || 0) + 1;
                    } else {
                        teamWeeklyWeekendGames[`${weekId}|${game.teamA.id}`] = (teamWeeklyWeekendGames[`${weekId}|${game.teamA.id}`] || 0) + 1;
                        teamWeeklyWeekendGames[`${weekId}|${game.teamB.id}`] = (teamWeeklyWeekendGames[`${weekId}|${game.teamB.id}`] || 0) + 1;
                    }

                    const gameEnd = gameStart + durationMins;
                    [game.teamA.headCoachId, game.teamA.asstCoachId, game.teamB.headCoachId, game.teamB.asstCoachId].filter(Boolean).forEach(cid => {
                        addCoachInterval(cid, day.dateStr, gameStart, gameEnd);
                    });

                    teamGamesLeft[game.teamA.id]--;
                    teamGamesLeft[game.teamB.id]--;

                    pendingGames.splice(bestGameIndex, 1);
                }
            }
        }
    }

    const unscheduledGames = pendingGames.map(g => ({ 
        ...g, 
        reason: `Constraints blocked scheduling (Check Field/Coach availability)` 
    }));

    return { 
        games: scheduledGames.sort((a,b) => a.dateStr.localeCompare(b.dateStr) || a.time.localeCompare(b.time)), 
        stats: { 
            totalGames: allGames.length, 
            scheduled: scheduledGames.length, 
            unscheduled: unscheduledGames.length, 
            unscheduledDetails: unscheduledGames
        } 
    };
  };

  // --- UI Renders ---

  // 1. Loading Screen
  if (appMode === 'loading') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-xl shadow-blue-200 mb-6 animate-bounce">
          <Calendar className="w-12 h-12" />
        </div>
        <h1 className="font-bold text-3xl tracking-tight text-slate-800 mb-2">
          LeagueScheduler<span className="text-blue-600">Pro</span>
        </h1>
        <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mt-4"></div>
      </div>
    );
  }

  // 2. Landing Page
  if (appMode === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-xl shadow-blue-200 mb-8">
          <Calendar className="w-16 h-16" />
        </div>
        <h1 className="font-extrabold text-4xl tracking-tight text-slate-800 mb-4">
          Welcome to the Portal
        </h1>
        <p className="text-slate-500 mb-10 max-w-md mx-auto text-lg">
          Please select the application you'd like to access today.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Option 1: League Scheduler Pro */}
          <button 
            onClick={() => setAppMode('scheduler')}
            className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 text-left flex flex-col justify-between h-64 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Calendar className="w-32 h-32" />
            </div>
            <div>
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                League Scheduler Pro
              </h2>
              <p className="text-slate-500 text-sm">
                Generate optimized schedules, manage constraints, and export.
              </p>
            </div>
            <div className="flex items-center text-blue-600 font-bold text-sm uppercase tracking-wider">
              Continue <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
            </div>
          </button>

          {/* Option 2: Home Run Derby Signup */}
          <button 
            onClick={() => { setAppMode('derby'); setIsCancelling(false); setDerbySubmitState(null); }}
            className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-orange-300 transition-all duration-300 text-left flex flex-col justify-between h-64 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Trophy className="w-32 h-32" />
            </div>
            <div>
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-6">
                <Trophy className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-orange-600 transition-colors">
                OMYBS Homerun Derby 2026
              </h2>
              <p className="text-slate-500 text-sm">
                Player signups and waitlist management.
              </p>
            </div>
            <div className="flex items-center text-orange-600 font-bold text-sm uppercase tracking-wider">
              Signup Now <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // 3. Derby Signup Form View
  if (appMode === 'derby') {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
            <button 
              onClick={() => { setAppMode('landing'); setDerbySubmitState(null); setIsCancelling(false); }}
              className="flex items-center text-slate-500 hover:text-slate-900 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </button>
            <div className="flex items-center gap-2 font-bold text-lg text-slate-800">
              <Trophy className="w-5 h-5 text-orange-500" /> Derby Signup
            </div>
            <div className="w-16"></div> {/* Spacer for center alignment */}
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-3">OMYBS Homerun Derby 2026</h1>
            <p className="text-slate-500">
              Space is limited to <span className="font-bold text-orange-600">40 participants per age group</span>. 
              Sign up below to secure your spot or join the waitlist!
            </p>
          </div>

          <Card className="p-6 md:p-8">
            {isCancelling ? (
              // CANCELLATION VIEW
              <div className="animate-in fade-in zoom-in duration-300">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Cancel Registration</h2>
                <p className="text-slate-600 mb-6 text-sm">
                  Enter the 6-character cancellation code you received when you signed up. This will instantly open your spot for the next player on the waitlist.
                </p>

                {cancelStatus === 'success' ? (
                   <div className="p-6 bg-green-50 text-green-800 rounded-xl border border-green-200 text-center">
                     <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                     <p className="font-bold">Cancellation Successful</p>
                     <p className="text-sm mt-1">Your spot has been released.</p>
                   </div>
                ) : (
                  <form onSubmit={handleCancelSpot} className="space-y-4">
                    {cancelStatus === 'invalid' && (
                      <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" /> Invalid code. Please check and try again.
                      </div>
                    )}
                    {cancelStatus === 'error' && (
                      <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" /> Error processing request.
                      </div>
                    )}

                    <Input 
                      label="Cancellation Code" 
                      required 
                      placeholder="e.g. X7B9A2"
                      value={cancelCodeInput}
                      onChange={e => setCancelCodeInput(e.target.value)}
                      className="uppercase font-mono tracking-widest text-center text-lg"
                    />

                    <div className="pt-2 flex gap-3">
                      <Button variant="secondary" fullWidth onClick={() => setIsCancelling(false)}>Go Back</Button>
                      <Button 
                        type="submit" 
                        variant="danger" 
                        fullWidth 
                        disabled={cancelStatus === 'processing' || !cancelCodeInput}
                      >
                        {cancelStatus === 'processing' ? 'Processing...' : 'Confirm Cancel'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : derbySubmitState?.status === 'success' ? (
              // SUCCESS VIEW
              <div className="text-center py-6 animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">You're In!</h2>
                <p className="text-slate-600 mb-6">Your registration has been confirmed for the 2026 Homerun Derby.</p>
                
                {/* PAYMENT SECTION */}
                <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl mb-6 text-center">
                  <h3 className="font-bold text-blue-900 text-lg mb-1">Registration Fee: $10</h3>
                  <p className="text-sm text-blue-700 mb-4">Please complete your payment via Venmo to finalize your spot.</p>
                  
                  <div className="flex flex-col items-center gap-4">
                    {/* Venmo Deep Link Button */}
                    <a 
                      href={`venmo://paycharge?txn=pay&recipients=omybs&amount=10&note=Derby Fee - ${encodeURIComponent(derbyForm.playerName)}`}
                      className="bg-[#008CFF] hover:bg-[#0074D9] text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors w-full justify-center shadow-sm"
                    >
                      Pay with Venmo
                    </a>
                    
                    <div className="flex items-center gap-3 w-full text-slate-400 text-sm">
                      <div className="h-px bg-blue-200 flex-1"></div>
                      OR SCAN
                      <div className="h-px bg-blue-200 flex-1"></div>
                    </div>

                    {/* Generates a dynamic QR code containing the exact same Venmo payment URL */}
                    <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm inline-block">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`venmo://paycharge?txn=pay&recipients=omybs&amount=10&note=Derby Fee - ${derbyForm.playerName}`)}`} 
                        alt="Venmo QR Code" 
                        className="w-32 h-32"
                      />
                    </div>
                    <p className="text-xs text-slate-500">@omybs</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-8 text-left">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Important: Save this code</p>
                  <p className="text-sm text-slate-700 mb-2">If you need to drop out, please use this code to cancel so the next child on the waitlist gets a spot:</p>
                  <div className="font-mono text-xl font-bold text-slate-900 bg-white border border-slate-300 py-2 px-4 rounded-lg text-center tracking-widest flex justify-center items-center gap-2">
                    {derbySubmitState.cancelCode}
                  </div>
                </div>

                <Button onClick={() => setDerbySubmitState(null)} fullWidth>Submit Another Player</Button>
              </div>
            ) : derbySubmitState?.status === 'waitlist' ? (
              // WAITLIST VIEW
              <div className="text-center py-6 animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ClipboardList className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Added to Waitlist</h2>
                <p className="text-slate-600 mb-6">
                  The selected age group has reached its 40-player capacity. You have been placed on the waitlist and will be notified if a spot opens up.
                </p>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-8 text-left">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Save this code</p>
                  <p className="text-sm text-slate-700 mb-2">If you no longer wish to be on the waitlist, you can cancel your request using this code:</p>
                  <div className="font-mono text-xl font-bold text-slate-900 bg-white border border-slate-300 py-2 px-4 rounded-lg text-center tracking-widest">
                    {derbySubmitState.cancelCode}
                  </div>
                </div>

                <Button variant="secondary" onClick={() => setDerbySubmitState(null)} fullWidth>Submit Another Player</Button>
              </div>
            ) : (
              // DEFAULT SIGNUP FORM
              <form onSubmit={handleDerbySubmit} className="space-y-5">
                {derbySubmitState?.status === 'error' && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">Something went wrong. Please check your connection and try again.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-600 ml-1">Age Group *</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-base shadow-sm"
                    value={derbyForm.ageGroup}
                    onChange={e => setDerbyForm({...derbyForm, ageGroup: e.target.value})}
                  >
                    <option value="" disabled>Select Age Group</option>
                    <option value="6u">6U</option>
                    <option value="7u">7U</option>
                    <option value="8u">8U</option>
                    <option value="9u/10u">9U / 10U</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input 
                    label="Player's Full Name *" 
                    required 
                    placeholder="John Doe"
                    value={derbyForm.playerName}
                    onChange={e => setDerbyForm({...derbyForm, playerName: e.target.value})}
                  />
                  <Input 
                    label="Nickname" 
                    placeholder="e.g. 'Slugger'"
                    value={derbyForm.nickname}
                    onChange={e => setDerbyForm({...derbyForm, nickname: e.target.value})}
                  />
                </div>

                <Input 
                  label="Spring 2026 Team Name *" 
                  required 
                  placeholder="e.g. Tigers"
                  value={derbyForm.teamName}
                  onChange={e => setDerbyForm({...derbyForm, teamName: e.target.value})}
                />

                <Input 
                  label="Email Address *" 
                  required 
                  type="email"
                  placeholder="parent@email.com"
                  value={derbyForm.email}
                  onChange={e => setDerbyForm({...derbyForm, email: e.target.value})}
                />

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    fullWidth 
                    disabled={derbySubmitState?.status === 'submitting'}
                    className="bg-orange-500 hover:bg-orange-600 shadow-orange-200 text-lg py-3"
                  >
                    {derbySubmitState?.status === 'submitting' ? 'Processing...' : 'Complete Signup'}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Cancellation Toggle */}
          {!isCancelling && (!derbySubmitState || derbySubmitState.status === 'error') && (
            <div className="mt-8 text-center">
              <button 
                type="button"
                onClick={() => setIsCancelling(true)}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-4"
              >
                Need to cancel a spot? Click here.
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 4. Scheduler View (Original App)
  // Reused render blocks below
  const renderSetup = () => (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" /> Season Duration
        </h3>
        <div className="grid gap-4">
          <Input label="Season Start" type="date" value={seasonConfig.startDate} onChange={e => setSeasonConfig({...seasonConfig, startDate: e.target.value})} />
          <Input label="Season End" type="date" value={seasonConfig.endDate} onChange={e => setSeasonConfig({...seasonConfig, endDate: e.target.value})} />
        </div>
        <div className="mt-6 pt-6 border-t border-slate-100">
           <div className="flex justify-between items-center mb-4">
               <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-500" /> Blackout Weeks (Optional)
               </h4>
               <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setSeasonConfig({
                   ...seasonConfig, 
                   blackoutPeriods: [...(seasonConfig.blackoutPeriods || []), { id: Date.now(), start: '', end: '' }]
               })}>
                   <Plus className="w-3 h-3" /> Add Period
               </Button>
           </div>
           
           <div className="space-y-3">
            {(seasonConfig.blackoutPeriods || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">No blackout periods set (e.g. Spring Break).</p>
            )}
            {(seasonConfig.blackoutPeriods || []).map((period, idx) => (
                <div key={period.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Start</label>
                        <Input type="date" value={period.start} onChange={e => {
                            const newPeriods = [...seasonConfig.blackoutPeriods];
                            newPeriods[idx].start = e.target.value;
                            setSeasonConfig({...seasonConfig, blackoutPeriods: newPeriods});
                        }} />
                    </div>
                    <div className="col-span-5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">End</label>
                        <Input type="date" value={period.end} onChange={e => {
                            const newPeriods = [...seasonConfig.blackoutPeriods];
                            newPeriods[idx].end = e.target.value;
                            setSeasonConfig({...seasonConfig, blackoutPeriods: newPeriods});
                        }} />
                    </div>
                    <div className="col-span-2 pb-1">
                        <button 
                            onClick={() => {
                                const newPeriods = seasonConfig.blackoutPeriods.filter(p => p.id !== period.id);
                                setSeasonConfig({...seasonConfig, blackoutPeriods: newPeriods});
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg border border-slate-200"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
           </div>
        </div>
      </Card>

      <Card className="p-5">
         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> Weekly Schedule
         </h3>
         <div className="space-y-5">
            {daysOfWeek.map((dayName, idx) => (
               <div key={idx} className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                     <input 
                        type="checkbox" 
                        checked={weeklySchedule[idx].active} 
                        onChange={() => toggleDayActive(idx)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                     />
                     <span className={`font-medium text-base ${weeklySchedule[idx].active ? 'text-slate-900' : 'text-slate-400'}`}>
                        {dayName}
                     </span>
                  </label>
                  {weeklySchedule[idx].active && (
                     <div className="pl-8">
                       <Input 
                          placeholder="e.g. 09:00, 11:00 (24h)"
                          value={weeklySchedule[idx].times}
                          onChange={(e) => updateDayTimes(idx, e.target.value)}
                       />
                     </div>
                  )}
               </div>
            ))}
         </div>
      </Card>
    </div>
  );

  const renderAgeGroups = () => (
    <Card className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Age Groups
          </h3>
          <Button variant="secondary" onClick={() => setAgeGroups([...ageGroups, { id: Date.now(), name: 'New Group', teamsCount: 4, gamesPerTeam: 8, gamesPerWeek: 1, maxWeekday: 1, maxWeekend: 2, duration: 90 }])}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
        {ageGroups.length === 0 ? (
           <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p>No groups yet.</p>
           </div>
        ) : (
           <div className="space-y-4">
             {ageGroups.map((group, idx) => (
               <div key={group.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
                  <button 
                     onClick={() => setAgeGroups(ageGroups.filter(g => g.id !== group.id))}
                     className="absolute top-2 right-2 p-2 text-slate-400 hover:text-red-500"
                  >
                     <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="grid gap-3">
                     <Input label="Group Name" value={group.name} onChange={e => { const n=[...ageGroups]; n[idx].name=e.target.value; setAgeGroups(n); }} />
                     <div className="grid grid-cols-2 gap-3">
                        <Input label="Teams" type="number" min="2" value={group.teamsCount} onChange={e => { const n=[...ageGroups]; n[idx].teamsCount=parseInt(e.target.value)||0; setAgeGroups(n); }} />
                        <Input label="Games/Tm" type="number" min="1" value={group.gamesPerTeam} onChange={e => { const n=[...ageGroups]; n[idx].gamesPerTeam=parseInt(e.target.value)||0; setAgeGroups(n); }} />
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                        <Input label="Wkday/Wk" type="number" min="0" value={group.maxWeekday !== undefined ? group.maxWeekday : 1} onChange={e => { const n=[...ageGroups]; n[idx].maxWeekday=parseInt(e.target.value)||0; setAgeGroups(n); }} />
                        <Input label="Wkend/Wk" type="number" min="0" value={group.maxWeekend !== undefined ? group.maxWeekend : 2} onChange={e => { const n=[...ageGroups]; n[idx].maxWeekend=parseInt(e.target.value)||0; setAgeGroups(n); }} />
                        <Input label="Duration" type="number" min="30" value={group.duration || 90} onChange={e => { const n=[...ageGroups]; n[idx].duration=parseInt(e.target.value)||90; setAgeGroups(n); }} />
                     </div>
                  </div>
               </div>
             ))}
           </div>
        )}
      </Card>
  );

  const renderFields = () => (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" /> Fields
        </h3>
        <Button variant="secondary" onClick={() => setFields([...fields, { id: Date.now(), name: 'New Field', allowedGroups: ageGroups.map(g=>g.id) }])}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
      <div className="space-y-4">
        {fields.length === 0 && <p className="text-slate-400 italic text-sm text-center">No fields added.</p>}
        {fields.map((field, idx) => (
          <div key={field.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <input 
                className="font-semibold text-lg bg-transparent border-b border-transparent focus:border-blue-500 outline-none w-full text-slate-900"
                placeholder="Field Name"
                value={field.name}
                onChange={e => { const n=[...fields]; n[idx].name=e.target.value; setFields(n); }}
              />
              <button onClick={() => setFields(fields.filter(f => f.id !== field.id))} className="text-slate-400 hover:text-red-500 ml-2">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ageGroups.length === 0 && <span className="text-xs text-slate-400">Add Age Groups first</span>}
              {ageGroups.map(group => {
                const isAllowed = field.allowedGroups.includes(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleFieldAllowance(field.id, group.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isAllowed 
                        ? 'bg-blue-100 text-blue-700 border-blue-200' 
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderCoaches = () => (
    <div className="space-y-6">
      <Card className="p-5">
         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" /> Coaches
          </h3>
          <div className="flex gap-2 mb-4">
             <div className="flex-1">
                <Input 
                   id="new-coach"
                   placeholder="Add coach name..." 
                   value={newCoachName}
                   onChange={(e) => setNewCoachName(e.target.value)}
                />
             </div>
             <div className="pt-7"> 
                <Button onClick={() => {
                   if(newCoachName.trim()) {
                      const names = newCoachName.split(',').map(n => n.trim()).filter(n => n);
                      const newCoaches = names.map(n => ({ id: `c-${Date.now()}-${Math.random()}`, name: n }));
                      setCoaches([...coaches, ...newCoaches]);
                      setNewCoachName('');
                   }
                }}>Add</Button>
             </div>
          </div>
          <div className="flex flex-wrap gap-2">
             {coaches.length === 0 && <p className="text-slate-400 italic text-sm">List is empty.</p>}
             {coaches.map(c => (
                <div key={c.id} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium border border-slate-200">
                   {c.name}
                   <button onClick={() => setCoaches(coaches.filter(x => x.id !== c.id))} className="text-slate-400 hover:text-red-500">×</button>
                </div>
             ))}
          </div>
      </Card>
      
      <Card className="p-5 mt-6">
        <h3 className="font-bold text-slate-800 mb-2">Import External Conflicts</h3>
        <p className="text-sm text-slate-500 mb-4">
           Paste CSV to block off times for specific coaches (e.g. from other divisions).
           <br/>
           Format: <code>YYYY-MM-DD, HH:MM, Duration(min), Coach Name</code>
        </p>
        <textarea 
           className="w-full border border-slate-300 rounded-xl p-3 text-sm font-mono h-32 focus:ring-2 focus:ring-blue-500 outline-none"
           placeholder="2026-03-01, 09:00, 90, Coach Mike&#10;2026-03-05, 17:30, 90, Coach Sarah"
           onBlur={(e) => parseConflicts(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
           {externalConflicts.length > 0 ? (
              <span className="text-sm text-green-600 font-bold flex items-center gap-1">
                 <CheckCircle className="w-4 h-4" /> {externalConflicts.length} conflicts loaded
              </span>
           ) : (
              <span className="text-sm text-slate-400">No conflicts loaded</span>
           )}
        </div>
     </Card>

      <Card className="p-5">
         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" /> Assignments
         </h3>
         {teams.length === 0 ? (
             <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg bg-slate-50">
                Go to "Fields & Groups" first.
             </div>
         ) : (
             <div className="space-y-6">
                {ageGroups.map(group => (
                   <div key={group.id}>
                      <h4 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-3 ml-1">{group.name} Division</h4>
                      <div className="grid gap-3">
                         {teams.filter(t => t.groupId === group.id).map(team => (
                            <div key={team.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                               <input 
                                 className="font-bold text-base bg-transparent w-full mb-3 border-b border-slate-200 focus:border-blue-500 outline-none text-slate-900 pb-1"
                                 value={team.name}
                                 onChange={(e) => setTeams(teams.map(t => t.id === team.id ? { ...t, name: e.target.value } : t))}
                               />
                               <div className="grid grid-cols-2 gap-3">
                                  <div>
                                     <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Head Coach</label>
                                     <select 
                                        className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white outline-none"
                                        value={team.headCoachId}
                                        onChange={(e) => handleUpdateTeamCoach(team.id, 'headCoachId', e.target.value)}
                                     >
                                        <option value="">Select...</option>
                                        {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                     </select>
                                  </div>
                                  <div>
                                     <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Assistant</label>
                                     <select 
                                        className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white outline-none"
                                        value={team.asstCoachId}
                                        onChange={(e) => handleUpdateTeamCoach(team.id, 'asstCoachId', e.target.value)}
                                     >
                                        <option value="">Select...</option>
                                        {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                     </select>
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                ))}
             </div>
         )}
      </Card>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-6">
      {scheduleStats && (
        <div className={`p-4 rounded-xl flex flex-col gap-3 ${scheduleStats.unscheduled > 0 ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-green-50 text-green-800 border border-green-100'}`}>
          <div className="flex items-center gap-3">
             {scheduleStats.unscheduled > 0 ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
             <div>
               <p className="font-bold">Scheduled {scheduleStats.scheduled} / {scheduleStats.totalGames} games</p>
             </div>
          </div>
          {scheduleStats.unscheduledDetails && scheduleStats.unscheduledDetails.length > 0 && (
              <div className="mt-2 text-xs bg-white/50 p-2 rounded max-h-32 overflow-y-auto">
                  <p className="font-bold mb-1">Unscheduled Games:</p>
                  {scheduleStats.unscheduledDetails.map((g, i) => (
                      <div key={i} className="mb-1 border-b border-black/5 pb-1">
                          {g.teamA.name} vs {g.teamB.name}: <span className="font-semibold">{g.reason}</span>
                      </div>
                  ))}
              </div>
          )}
        </div>
      )}

      {schedule.length > 0 && (
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" /> Export Options
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <Button variant="outline" className="w-full py-3" onClick={() => exportToICS()}>
                   <CalendarCheck className="w-4 h-4" /> Save to Calendar (.ics)
                </Button>
                <Button variant="outline" onClick={() => window.print()} className="w-full py-3">
                   <Download className="w-4 h-4" /> Print / PDF
                </Button>
            </div>
            
            <div className="border-t border-slate-100 pt-4">
                <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">GameChanger (CSV)</h5>
                <div className="flex flex-wrap gap-2">
                   <Button variant="secondary" className="text-xs py-1.5" onClick={() => exportToGameChanger(null)}>
                      All
                   </Button>
                   {ageGroups.map(group => (
                      <Button key={group.id} variant="secondary" className="text-xs py-1.5" onClick={() => exportToGameChanger(group.id)}>
                         {group.name}
                      </Button>
                   ))}
                </div>
            </div>
         </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
         {schedule.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
               <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
               <p>No schedule yet.</p>
            </div>
         ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                     <tr>
                        <th className="p-4 min-w-[120px]">Time</th>
                        <th className="p-4">Matchup</th>
                        <th className="p-4 hidden md:table-cell">Field</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {schedule.map((game) => (
                       <tr key={game.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 align-top">
                             <div className="font-bold text-slate-900">{game.displayDate}</div>
                             <div className="text-slate-500">{game.time}</div>
                             <div className="md:hidden text-xs font-semibold text-blue-600 mt-1">{game.fieldName}</div>
                          </td>
                          <td className="p-4 align-top">
                             <div className="font-medium text-slate-900 text-base">{game.teamA.name}</div>
                             <div className="text-xs text-slate-400 my-0.5">vs</div>
                             <div className="font-medium text-slate-900 text-base">{game.teamB.name}</div>
                             <div className="mt-2 text-xs text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded">
                                {ageGroups.find(g => g.id === game.groupId)?.name}
                             </div>
                          </td>
                          <td className="p-4 hidden md:table-cell align-top text-slate-600">
                             {game.fieldName}
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </div>
    </div>
  );
  
  const renderTeamSchedules = () => (
      <div className="space-y-6">
          {teams.map(team => {
              const teamGames = schedule.filter(g => g.teamA.id === team.id || g.teamB.id === team.id);
              if(teamGames.length === 0) return null;
              
              return (
                  <Card key={team.id} className="p-0">
                      <div className="bg-slate-50 p-4 border-b border-slate-100">
                          <h3 className="font-bold text-lg text-slate-800">{team.name}</h3>
                          <p className="text-xs text-slate-500">{teamGames.length} Games Scheduled</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                          {teamGames.map(game => {
                              const isHome = game.teamA.id === team.id;
                              const opponent = isHome ? game.teamB : game.teamA;
                              return (
                                  <div key={game.id} className="p-4 flex justify-between items-center">
                                      <div>
                                          <div className="font-semibold text-slate-900">{game.displayDate} @ {game.time}</div>
                                          <div className="text-xs text-slate-500">{game.fieldName}</div>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-xs font-bold text-slate-400 uppercase">{isHome ? 'VS' : 'AT'}</div>
                                          <div className="font-medium text-blue-600">{opponent.name}</div>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </Card>
              )
          })}
          {schedule.length === 0 && <p className="text-center text-slate-400 py-8">Generate a schedule first.</p>}
      </div>
  );

  const renderSaves = () => (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Save className="w-5 h-5 text-blue-600" /> Saved Schedules
          </h3>
          <Button onClick={saveSchedule}>
            <Plus className="w-4 h-4" /> Save Current
          </Button>
        </div>
        
        {savedSchedules.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No saved schedules found.</p>
        ) : (
          <div className="space-y-3">
            {savedSchedules.map(save => (
              <div key={save.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">{save.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(save.createdAt).toLocaleDateString()} • {save.schedule?.length || 0} games
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => loadSchedule(save)}>Load</Button>
                  <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => deleteSchedule(save.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      
      <div className="p-4 bg-slate-100 text-slate-500 rounded-xl text-sm flex gap-2 items-start">
         <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
         <p>Using <strong>Offline Storage</strong>. Schedules are saved only on this device. If you delete the app or clear cache, data will be lost.</p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'setup', label: '1. Setup', icon: Calendar },
    { id: 'fields', label: '2. Groups', icon: Users },
    { id: 'coaches', label: '3. Teams', icon: UserCheck },
    { id: 'schedule', label: '4. Schedule', icon: Settings },
    { id: 'team-schedules', label: 'By Team', icon: Search },
    { id: 'saves', label: 'Saves', icon: FolderOpen },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32 md:pb-10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
           <div className="flex items-center gap-2.5">
              <button 
                onClick={() => setAppMode('landing')}
                className="hover:bg-slate-100 p-2 rounded-lg transition-colors mr-1 -ml-2"
                title="Back to Main Menu"
              >
                <ArrowLeft className="w-5 h-5 text-slate-500" />
              </button>
              <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                <Calendar className="w-5 h-5" />
              </div>
              <h1 className="font-bold text-lg md:text-xl tracking-tight text-slate-800">
                LeagueScheduler<span className="text-blue-600">Pro</span>
              </h1>
           </div>
           
           <div className="hidden md:block">
             {activeTab === 'schedule' ? (
                <Button variant="secondary" onClick={generateSchedule} disabled={isGenerating}>Regenerate</Button>
             ) : activeTab !== 'saves' && activeTab !== 'team-schedules' ? (
               <Button onClick={generateSchedule} disabled={isGenerating}>
                 {isGenerating ? 'Working...' : 'Generate Schedule'} <ChevronRight className="w-4 h-4" />
               </Button>
             ) : null}
           </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-6 pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                  isActive 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' 
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           {activeTab === 'setup' && renderSetup()}
           {activeTab === 'fields' && <div className="space-y-6">{renderAgeGroups()}{renderFields()}</div>}
           {activeTab === 'coaches' && renderCoaches()}
           {activeTab === 'schedule' && renderSchedule()}
           {activeTab === 'team-schedules' && renderTeamSchedules()}
           {activeTab === 'saves' && renderSaves()}
        </div>
      </main>

      {/* Mobile Sticky Footer Action Bar */}
      {activeTab !== 'saves' && activeTab !== 'team-schedules' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-30 pb-[env(safe-area-inset-bottom)]">
           {activeTab !== 'schedule' ? (
             <Button onClick={generateSchedule} disabled={isGenerating} fullWidth className="bg-blue-600 text-white shadow-lg shadow-blue-200 py-3.5 text-lg">
               {isGenerating ? 'Working...' : 'Generate Schedule'}
             </Button>
           ) : (
              <Button variant="secondary" onClick={generateSchedule} disabled={isGenerating} fullWidth className="py-3.5 text-lg border-2">
                 Regenerate Schedule
              </Button>
           )}
        </div>
      )}
    </div>
  );
}