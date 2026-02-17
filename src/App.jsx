import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  MapPin, 
  Settings, 
  ChevronRight, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Calendar as CalendarIcon,
  Shield,
  UserCheck,
  Download,
  Clock,
  CalendarCheck,
  Share,
  Save,
  FolderOpen,
  Search,
  Printer,
  WifiOff,
  FileText
} from 'lucide-react';

// --- Local Storage Abstraction ---
const storage = {
  // Key for local storage
  KEY: 'baseball_schedules',

  // Load all saved schedules
  loadAll: function() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load local saves", e);
      return [];
    }
  },

  // Save a new schedule
  save: function(data) {
    const saves = this.loadAll();
    const newSave = { 
      ...data, 
      id: `local-${Date.now()}`, 
      createdAt: new Date().toISOString() 
    };
    saves.unshift(newSave);
    localStorage.setItem(this.KEY, JSON.stringify(saves));
    return newSave;
  },

  // Delete a schedule
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

const generateDates = (start, end, blackoutStart, blackoutEnd, weeklySchedule) => {
  if (!start || !end) return [];
  
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  current.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);
  
  const bStart = blackoutStart ? new Date(blackoutStart) : null;
  const bEnd = blackoutEnd ? new Date(blackoutEnd) : null;
  if(bStart) bStart.setHours(0,0,0,0);
  if(bEnd) bEnd.setHours(0,0,0,0);

  while (current <= endDate) {
    const day = current.getDay(); 
    const scheduleForDay = weeklySchedule[day];

    let isBlackout = false;
    if (bStart && bEnd) {
      if (current >= bStart && current <= bEnd) isBlackout = true;
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('setup');
  
  // Data State
  const [savedSchedules, setSavedSchedules] = useState([]);
  
  // App State
  const [seasonConfig, setSeasonConfig] = useState({ startDate: '', endDate: '', blackoutStart: '', blackoutEnd: '' });
  const [weeklySchedule, setWeeklySchedule] = useState({
    0: { active: false, times: '' }, 1: { active: false, times: '' }, 2: { active: false, times: '' },
    3: { active: false, times: '' }, 4: { active: false, times: '' }, 5: { active: false, times: '' },
    6: { active: false, times: '' }
  });
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [ageGroups, setAgeGroups] = useState([]);
  const [fields, setFields] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduleStats, setScheduleStats] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  
  // NEW: External Conflicts State
  const [externalConflicts, setExternalConflicts] = useState([]);

  // --- Effects ---
  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    
    // Load initial saves
    setSavedSchedules(storage.loadAll());

    return () => clearTimeout(timer);
  }, []);

  // Teams Sync
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

  // --- Handlers ---
  const saveSchedule = async () => {
    const name = prompt("Enter a name for this save:", `Schedule ${new Date().toLocaleDateString()}`);
    if (!name) return;

    const data = { name, seasonConfig, weeklySchedule, ageGroups, fields, coaches, teams, schedule, scheduleStats, externalConflicts };
    try {
      storage.save(data);
      setSavedSchedules(storage.loadAll()); // Refresh list
      alert("Saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Error saving.");
    }
  };

  const loadSchedule = (save) => {
    if (!confirm("Load this schedule? Unsaved changes will be lost.")) return;
    setSeasonConfig(save.seasonConfig || {});
    setWeeklySchedule(save.weeklySchedule || {});
    setAgeGroups(save.ageGroups || []);
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
    setSavedSchedules(storage.loadAll()); // Refresh list
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

  const handleNumericInput = (val) => {
    if (val === '') return '';
    return parseInt(val);
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

  // --- Export Logic ---
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

  // --- Algorithm with Diagnostics ---
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
    const calendarDays = generateDates(seasonConfig.startDate, seasonConfig.endDate, seasonConfig.blackoutStart, seasonConfig.blackoutEnd, weeklySchedule);
    if (calendarDays.length === 0) throw new Error("No valid dates found.");
    
    let allGames = [], gameIdCounter = 1;
    
    // --- MATCHUP GENERATION (ROUND ROBIN) ---
    ageGroups.forEach(group => {
      const groupTeams = teams.filter(t => t.groupId === group.id);
      if (groupTeams.length < 2) return;

      const gamesNeeded = Number(group.gamesPerTeam);
      
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
      for (let i = 0; i < gamesNeeded; i++) {
         const r = rounds[i % rounds.length];
         r.forEach(match => {
            finalMatchups.push({
               id: `g-${gameIdCounter++}`, 
               groupId: group.id, 
               teamA: match.teamA, 
               teamB: match.teamB 
            });
         });
      }

      allGames = [...allGames, ...finalMatchups];
    });
    
    allGames.sort(() => Math.random() - 0.5);
    
    // --- MULTI-PASS SCHEDULER ---
    
    const scheduledGames = [];
    const unscheduledGames = [];
    
    // State Tracking
    const fieldOccupancy = new Set(); 
    const teamDailyGames = {};
    const teamWeeklyGames = {};
    const teamWeeklyWeekdayGames = {};
    const matchupHistory = {};
    const coachIntervals = {}; 
    const GAP_BUFFER_MINS = 30;
    
    const matchupSides = {};
    const teamHomeCounts = {};

    // NEW: Load External Conflicts into Coach Intervals
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

    const attemptScheduleGame = (game, strictMode) => {
       const groupConfig = ageGroups.find(g => g.id === game.groupId);
       const maxGamesPerWeek = Number(groupConfig?.gamesPerWeek) || 2;
       const durationMins = Number(groupConfig?.duration) || 90;

       for (let day of calendarDays) {
          const weekId = getWeekIdentifier(day.dateObj);
          
          // 1. MATCHUP CHECK
          const [yStr, wStr] = weekId.split('-');
          const currentAbsWeek = parseInt(yStr) * 53 + parseInt(wStr);
          const tIds = [game.teamA.id, game.teamB.id].sort();
          const mKey = `${tIds[0]}|${tIds[1]}`;
          const previousWeeks = matchupHistory[mKey] || [];
          
          let matchupConflict = false;
          for (const prevW of previousWeeks) {
              const diff = Math.abs(currentAbsWeek - prevW);
              const limit = strictMode.strictMatchup ? 1 : 0;
              if (diff <= limit) { 
                  matchupConflict = true;
                  break;
              }
          }
          if (matchupConflict) continue;

          // 2. TEAM LIMIT CHECKS
          const isWeekday = day.dayOfWeek >= 1 && day.dayOfWeek <= 5;
          const tA_WW = teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] || 0;
          const tB_WW = teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] || 0;
          
          if (strictMode.strictWeekday && isWeekday && (maxGamesPerWeek === 1 || tA_WW >= 1 || tB_WW >= 1)) continue;
          
          const tA_W = teamWeeklyGames[`${weekId}|${game.teamA.id}`] || 0;
          const tB_W = teamWeeklyGames[`${weekId}|${game.teamB.id}`] || 0;
          const limit = strictMode.strictWeeklyMax ? maxGamesPerWeek : maxGamesPerWeek + 1;
          if (tA_W >= limit || tB_W >= limit) continue;
          
          const tA_D = teamDailyGames[`${day.dateStr}|${game.teamA.id}`] || 0;
          const tB_D = teamDailyGames[`${day.dateStr}|${game.teamB.id}`] || 0;
          if (tA_D >= 1 || tB_D >= 1) continue; 

          // 3. SLOT SEARCH
          for (let time of day.slots) {
             let placed = false;
             for (let field of fields) {
                if (fieldOccupancy.has(`${day.dateStr}|${time}|${field.id}`)) continue;
                if (!fields.find(f => f.id === field.id).allowedGroups.includes(game.groupId)) continue;
                
                if (hasCoachConflict(game.teamA, game.teamB, day.dateStr, time, durationMins)) continue;

                placed = true;
                fieldOccupancy.add(`${day.dateStr}|${time}|${field.id}`);
                
                if (!matchupHistory[mKey]) matchupHistory[mKey] = [];
                matchupHistory[mKey].push(currentAbsWeek);

                const gameStart = timeToMins(time);
                const gameEnd = gameStart + durationMins;
                [game.teamA.headCoachId, game.teamA.asstCoachId, game.teamB.headCoachId, game.teamB.asstCoachId].filter(Boolean).forEach(cid => {
                   addCoachInterval(cid, day.dateStr, gameStart, gameEnd);
                });

                teamDailyGames[`${day.dateStr}|${game.teamA.id}`] = (teamDailyGames[`${day.dateStr}|${game.teamA.id}`] || 0) + 1;
                teamDailyGames[`${day.dateStr}|${game.teamB.id}`] = (teamDailyGames[`${day.dateStr}|${game.teamB.id}`] || 0) + 1;
                teamWeeklyGames[`${weekId}|${game.teamA.id}`] = (teamWeeklyGames[`${weekId}|${game.teamA.id}`] || 0) + 1;
                teamWeeklyGames[`${weekId}|${game.teamB.id}`] = (teamWeeklyGames[`${weekId}|${game.teamB.id}`] || 0) + 1;
                if (isWeekday) {
                   teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] = (teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] || 0) + 1;
                   teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] = (teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] || 0) + 1;
                }
                
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
                return true;
             }
             if(placed) break;
          }
          if (scheduledGames.find(g => g.id === game.id)) break;
       }
       return scheduledGames.find(g => g.id === game.id);
    };

    let pendingGames = [...allGames];
    let nextPassGames = [];
    for (const game of pendingGames) {
       if (!attemptScheduleGame(game, { strictMatchup: true, strictWeeklyMax: true, strictWeekday: true })) {
          nextPassGames.push(game);
       }
    }

    if (nextPassGames.length > 0) {
        pendingGames = [...nextPassGames];
        nextPassGames = [];
        for (const game of pendingGames) {
           if (!attemptScheduleGame(game, { strictMatchup: false, strictWeeklyMax: true, strictWeekday: true })) {
              nextPassGames.push(game);
           }
        }
    }

    if (nextPassGames.length > 0) {
        pendingGames = [...nextPassGames];
        nextPassGames = [];
        for (const game of pendingGames) {
           if (!attemptScheduleGame(game, { strictMatchup: false, strictWeeklyMax: false, strictWeekday: false })) {
              nextPassGames.push({ ...game, reason: 'No slots available (Coach/Field conflict)' });
           }
        }
    }
    
    unscheduledGames.push(...nextPassGames);

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

  // --- UI Sections ---

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-xl shadow-blue-200 mb-6 animate-bounce">
          <CalendarIcon className="w-12 h-12" />
        </div>
        <h1 className="font-bold text-3xl tracking-tight text-slate-800 mb-2">
          LeagueScheduler<span className="text-blue-600">Pro</span>
        </h1>
        <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mt-4"></div>
      </div>
    );
  }

  const renderSetup = () => (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600" /> Season Duration
        </h3>
        <div className="grid gap-4">
          <Input label="Season Start" type="date" value={seasonConfig.startDate} onChange={e => setSeasonConfig({...seasonConfig, startDate: e.target.value})} />
          <Input label="Season End" type="date" value={seasonConfig.endDate} onChange={e => setSeasonConfig({...seasonConfig, endDate: e.target.value})} />
        </div>
        <div className="mt-6 pt-6 border-t border-slate-100">
           <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-500" /> Blackout Week (Optional)
           </h4>
           <div className="grid gap-4">
            <Input label="Start Date" type="date" value={seasonConfig.blackoutStart} onChange={e => setSeasonConfig({...seasonConfig, blackoutStart: e.target.value})} />
            <Input label="End Date" type="date" value={seasonConfig.blackoutEnd} onChange={e => setSeasonConfig({...seasonConfig, blackoutEnd: e.target.value})} />
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
                     <input type="checkbox" checked={weeklySchedule[idx].active} onChange={() => toggleDayActive(idx)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                     <span className={`font-medium text-base ${weeklySchedule[idx].active ? 'text-slate-900' : 'text-slate-400'}`}>{dayName}</span>
                  </label>
                  {weeklySchedule[idx].active && (
                     <div className="pl-8">
                       <Input placeholder="e.g. 09:00, 11:00 (24h)" value={weeklySchedule[idx].times} onChange={(e) => updateDayTimes(idx, e.target.value)} />
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
          <Button variant="secondary" onClick={() => setAgeGroups([...ageGroups, { id: Date.now(), name: 'New Group', teamsCount: 4, gamesPerTeam: 8, gamesPerWeek: 1, duration: 90 }])}>
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
                     <div className="grid grid-cols-2 gap-3">
                        <Input label="Games/Wk" type="number" min="1" value={group.gamesPerWeek || 2} onChange={e => { const n=[...ageGroups]; n[idx].gamesPerWeek=parseInt(e.target.value)||0; setAgeGroups(n); }} />
                        <Input label="Mins" type="number" min="30" value={group.duration || 90} onChange={e => { const n=[...ageGroups]; n[idx].duration=parseInt(e.target.value)||90; setAgeGroups(n); }} />
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
      
      {/* Import Conflicts Card */}
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
      {/* Header - Simplified for Mobile */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
           <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <h1 className="font-bold text-lg md:text-xl tracking-tight text-slate-800">
                LeagueScheduler<span className="text-blue-600">Pro</span>
              </h1>
           </div>
           
           {/* Desktop Only Button */}
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
        
        {/* Scrollable Mobile Tabs */}
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

        {/* Content Area */}
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