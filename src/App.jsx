import React, { useState, useEffect, useMemo } from 'react';
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
  FileSpreadsheet,
  Clock,
  CalendarCheck
} from 'lucide-react';

// --- Helper Functions ---

const generateDates = (start, end, blackoutStart, blackoutEnd, weeklySchedule) => {
  if (!start || !end) return [];
  
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  // Normalize times to midnight to avoid DST issues during simple iteration
  current.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);
  
  const bStart = blackoutStart ? new Date(blackoutStart) : null;
  const bEnd = blackoutEnd ? new Date(blackoutEnd) : null;
  if(bStart) bStart.setHours(0,0,0,0);
  if(bEnd) bEnd.setHours(0,0,0,0);

  while (current <= endDate) {
    const day = current.getDay(); // 0 = Sun, 6 = Sat
    const scheduleForDay = weeklySchedule[day];

    let isBlackout = false;
    if (bStart && bEnd) {
      if (current >= bStart && current <= bEnd) isBlackout = true;
    }

    if (scheduleForDay && scheduleForDay.active && !isBlackout) {
      // Parse the comma-separated times
      const slots = scheduleForDay.times
        .split(',')
        .map(t => t.trim())
        .filter(t => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t)) // Simple validation
        .sort();

      if (slots.length > 0) {
        dates.push({
          dateStr: current.toISOString().split('T')[0],
          dateObj: new Date(current), // Store actual date object for week calculation
          dayOfWeek: day, // 0-6
          displayDate: current.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          slots: slots
        });
      }
    }
    // Advance 1 day
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const getWeekIdentifier = (dateObj) => {
  // Returns a string key for the week (e.g., "2024-15" for 15th week)
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-${weekNo}`;
};

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = 'primary', disabled = false, className = '' }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, min }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-slate-700 truncate" title={label}>{label}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all w-full"
    />
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('setup');
  
  // --- State ---
  
  // 1. General Settings
  const [seasonConfig, setSeasonConfig] = useState({
    startDate: '', 
    endDate: '',   
    blackoutStart: '',
    blackoutEnd: ''
  });

  // 2. Weekly Schedule (0=Sun, 6=Sat) - CLEAN SLATE
  const [weeklySchedule, setWeeklySchedule] = useState({
    0: { active: false, times: '' },
    1: { active: false, times: '' },
    2: { active: false, times: '' },
    3: { active: false, times: '' },
    4: { active: false, times: '' }, 
    5: { active: false, times: '' },
    6: { active: false, times: '' }
  });

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // 3. Age Groups - CLEAN SLATE
  const [ageGroups, setAgeGroups] = useState([]);

  // 4. Fields - CLEAN SLATE
  const [fields, setFields] = useState([]);

  // 5. Coaches - CLEAN SLATE
  const [coaches, setCoaches] = useState([]);

  // 6. Teams (Empty - derived)
  const [teams, setTeams] = useState([]);

  // 7. Schedule Output
  const [schedule, setSchedule] = useState([]);
  const [scheduleStats, setScheduleStats] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Effects ---

  // Initialize teams when age groups change
  useEffect(() => {
    let newTeams = [];
    let hasChanges = false;

    ageGroups.forEach(group => {
      // Find existing teams for this group to preserve assignments/names
      const existingGroupTeams = teams.filter(t => t.groupId === group.id);
      
      for (let i = 0; i < group.teamsCount; i++) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroups]); // Exclude 'teams' to prevent loops


  // --- Logic & Handlers ---

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

  const exportToGameChanger = (groupId = null) => {
    const gamesToExport = groupId 
      ? schedule.filter(g => g.groupId === groupId)
      : schedule;

    if (gamesToExport.length === 0) {
      alert("No games to export for this selection.");
      return;
    }

    const headers = ["Date", "Start Time", "End Time", "Location", "Home Team", "Away Team"];
    
    const rows = gamesToExport.map(game => {
      const [year, month, day] = game.dateStr.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day); 
      const dateStr = dateObj.toLocaleDateString('en-US'); 
      
      const [hours, mins] = game.time.split(':').map(Number);
      const startDateObj = new Date(2000, 0, 1, hours, mins);
      
      // Use the specific age group duration
      const group = ageGroups.find(g => g.id === game.groupId);
      const duration = group ? group.duration : 90;
      
      const endDateObj = new Date(startDateObj.getTime() + duration*60000);
      
      const formatTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      return [
        dateStr,
        formatTime(startDateObj),
        formatTime(endDateObj),
        game.fieldName,
        game.teamA.name,
        game.teamB.name
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    let filename = groupId 
      ? `schedule_${ageGroups.find(g => g.id === groupId)?.name.replace(/\s+/g, '_')}.csv` 
      : 'full_schedule.csv';
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToICS = () => {
    if (schedule.length === 0) {
      alert("No schedule generated to export.");
      return;
    }

    // Helper to format date for ICS: YYYYMMDDTHHMMSS
    const formatICSDate = (dateStr, timeStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      // Create a date object. Note: ICS often expects UTC, but for local leagues, floating time (no Z) is often preferred 
      // so it locks to the user's calendar timezone. We will use floating time format (YYYYMMDDTHHMMSS).
      const pad = (n) => n < 10 ? '0' + n : n;
      return `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
    };

    // Helper to add minutes to a date and return ICS format
    const formatICSEndDate = (dateStr, timeStr, durationMins) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const d = new Date(year, month - 1, day, hour, minute);
      d.setMinutes(d.getMinutes() + durationMins);
      
      const pad = (n) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    };

    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LeagueSchedulerPro//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    schedule.forEach((game, index) => {
      const group = ageGroups.find(g => g.id === game.groupId);
      const duration = group ? group.duration : 90;
      
      const dtStart = formatICSDate(game.dateStr, game.time);
      const dtEnd = formatICSEndDate(game.dateStr, game.time, duration);
      
      const headCoachA = coaches.find(c => c.id === game.teamA.headCoachId)?.name || 'TBD';
      const headCoachB = coaches.find(c => c.id === game.teamB.headCoachId)?.name || 'TBD';

      icsContent.push("BEGIN:VEVENT");
      icsContent.push(`UID:${game.id}-${index}@leaguescheduler.pro`);
      icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').split('Z')[0]}Z`);
      icsContent.push(`DTSTART:${dtStart}`);
      icsContent.push(`DTEND:${dtEnd}`);
      icsContent.push(`SUMMARY:${game.teamA.name} vs ${game.teamB.name}`);
      icsContent.push(`LOCATION:${game.fieldName}`);
      icsContent.push(`DESCRIPTION:Division: ${group?.name || ''}\\nHome: ${game.teamA.name} (${headCoachA})\\nAway: ${game.teamB.name} (${headCoachB})`);
      icsContent.push("STATUS:CONFIRMED");
      icsContent.push("END:VEVENT");
    });

    icsContent.push("END:VCALENDAR");

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'league_schedule.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const runSchedulingAlgorithm = () => {
    if (!seasonConfig.startDate || !seasonConfig.endDate) {
      throw new Error("Please set Season Start and End dates.");
    }
    const calendarDays = generateDates(seasonConfig.startDate, seasonConfig.endDate, seasonConfig.blackoutStart, seasonConfig.blackoutEnd, weeklySchedule);
    if (calendarDays.length === 0) throw new Error("No valid game dates found based on your dates and weekly schedule.");

    let allGames = [];
    let gameIdCounter = 1;

    // Generate Matchups
    ageGroups.forEach(group => {
      const groupTeams = teams.filter(t => t.groupId === group.id);
      if (groupTeams.length < 2) return; // Skip if not enough teams

      const totalGamesNeeded = (group.teamsCount * group.gamesPerTeam) / 2;
      let matchups = [];
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          matchups.push({ 
            id: `g-${gameIdCounter++}`,
            groupId: group.id,
            teamA: groupTeams[i],
            teamB: groupTeams[j],
            label: `${groupTeams[i].name} vs ${groupTeams[j].name}`
          });
        }
      }

      if (matchups.length === 0) return;

      let finalMatchups = [...matchups];
      while (finalMatchups.length < totalGamesNeeded) {
        finalMatchups = [...finalMatchups, ...matchups];
      }
      finalMatchups = finalMatchups.slice(0, totalGamesNeeded);
      allGames = [...allGames, ...finalMatchups];
    });

    allGames.sort(() => Math.random() - 0.5);

    const scheduledGames = [];
    const unscheduledGames = [];
    const coachOccupancy = new Set();
    const fieldOccupancy = new Set();
    const teamDailyGames = {};
    const teamWeeklyGames = {};
    // Track how many WEEKDAY games a team plays per week
    const teamWeeklyWeekdayGames = {};

    const hasCoachConflict = (teamA, teamB, dateStr, timeStr) => {
      const coachesToCheck = [
        teamA.headCoachId, teamA.asstCoachId,
        teamB.headCoachId, teamB.asstCoachId
      ].filter(Boolean);

      for (let coachId of coachesToCheck) {
        if (coachOccupancy.has(`${dateStr}|${timeStr}|${coachId}`)) return true;
      }
      return false;
    };

    const isFieldValid = (field, groupId) => field.allowedGroups.includes(groupId);

    for (let game of allGames) {
      let placed = false;
      const groupConfig = ageGroups.find(g => g.id === game.groupId);
      const maxGamesPerWeek = groupConfig ? (groupConfig.gamesPerWeek || 10) : 10;

      for (let day of calendarDays) {
        if (placed) break;
        const weekId = getWeekIdentifier(day.dateObj);
        
        // Identify if this is a Weekend or Weekday
        // 0=Sun, 6=Sat (Weekend)
        // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri (Weekday)
        const isWeekday = day.dayOfWeek >= 1 && day.dayOfWeek <= 5;

        // --- NEW LOGIC: Enforce Saturday Priority & Weekday Spacing ---
        
        const tA_WeeklyWeekday = teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] || 0;
        const tB_WeeklyWeekday = teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] || 0;

        if (isWeekday) {
           // Rule 1: If strict 1 game/week, FORCE it to be weekend (Sat/Sun) unless no weekend slots exist
           // This ensures "Every team plays on Saturday" for 1-game teams
           if (maxGamesPerWeek === 1) continue;

           // Rule 2: If >1 game/week, Cap Weekday games at 1 per week.
           // This enforces "Tuesday OR Thursday, not both" logic.
           if (tA_WeeklyWeekday >= 1 || tB_WeeklyWeekday >= 1) continue;
        }

        // Standard Weekly Limit Check
        const tA_Weekly = teamWeeklyGames[`${weekId}|${game.teamA.id}`] || 0;
        const tB_Weekly = teamWeeklyGames[`${weekId}|${game.teamB.id}`] || 0;
        if (tA_Weekly >= maxGamesPerWeek || tB_Weekly >= maxGamesPerWeek) continue;

        // Daily Limit Check
        const tA_Daily = teamDailyGames[`${day.dateStr}|${game.teamA.id}`] || 0;
        const tB_Daily = teamDailyGames[`${day.dateStr}|${game.teamB.id}`] || 0;
        if (tA_Daily >= 1 || tB_Daily >= 1) continue; 

        for (let time of day.slots) {
          if (placed) break;
          for (let field of fields) {
             if (placed) break;
             if (fieldOccupancy.has(`${day.dateStr}|${time}|${field.id}`)) continue;
             if (!isFieldValid(field, game.groupId)) continue;
             if (hasCoachConflict(game.teamA, game.teamB, day.dateStr, time)) continue;

             placed = true;
             fieldOccupancy.add(`${day.dateStr}|${time}|${field.id}`);
             [game.teamA.headCoachId, game.teamA.asstCoachId, game.teamB.headCoachId, game.teamB.asstCoachId].filter(Boolean).forEach(cid => {
                coachOccupancy.add(`${day.dateStr}|${time}|${cid}`);
             });
             
             // Update Trackers
             teamDailyGames[`${day.dateStr}|${game.teamA.id}`] = (teamDailyGames[`${day.dateStr}|${game.teamA.id}`] || 0) + 1;
             teamDailyGames[`${day.dateStr}|${game.teamB.id}`] = (teamDailyGames[`${day.dateStr}|${game.teamB.id}`] || 0) + 1;
             
             teamWeeklyGames[`${weekId}|${game.teamA.id}`] = (teamWeeklyGames[`${weekId}|${game.teamA.id}`] || 0) + 1;
             teamWeeklyGames[`${weekId}|${game.teamB.id}`] = (teamWeeklyGames[`${weekId}|${game.teamB.id}`] || 0) + 1;

             if (isWeekday) {
                teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] = (teamWeeklyWeekdayGames[`${weekId}|${game.teamA.id}`] || 0) + 1;
                teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] = (teamWeeklyWeekdayGames[`${weekId}|${game.teamB.id}`] || 0) + 1;
             }

             scheduledGames.push({
               ...game,
               dateStr: day.dateStr,
               displayDate: day.displayDate,
               time,
               fieldId: field.id,
               fieldName: field.name
             });
          }
        }
      }
      if (!placed) unscheduledGames.push(game);
    }

    return {
      games: scheduledGames.sort((a,b) => a.dateStr.localeCompare(b.dateStr) || a.time.localeCompare(b.time)),
      stats: {
        totalGames: allGames.length,
        scheduled: scheduledGames.length,
        unscheduled: unscheduledGames.length,
        message: unscheduledGames.length > 0 
          ? `Could not schedule ${unscheduledGames.length} games. Check dates or fields.`
          : 'All games scheduled successfully!'
      }
    };
  };

  // --- Views ---

  const renderSetup = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600" /> Season Duration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Season Start" type="date" value={seasonConfig.startDate} onChange={e => setSeasonConfig({...seasonConfig, startDate: e.target.value})} />
          <Input label="Season End" type="date" value={seasonConfig.endDate} onChange={e => setSeasonConfig({...seasonConfig, endDate: e.target.value})} />
        </div>
        
        <div className="mt-6 pt-6 border-t border-slate-100">
           <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-500" /> Blackout Week (Optional)
           </h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={seasonConfig.blackoutStart} onChange={e => setSeasonConfig({...seasonConfig, blackoutStart: e.target.value})} />
            <Input label="End Date" type="date" value={seasonConfig.blackoutEnd} onChange={e => setSeasonConfig({...seasonConfig, blackoutEnd: e.target.value})} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
         <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> Weekly Schedule & Time Slots
         </h3>
         <div className="space-y-4">
            {daysOfWeek.map((dayName, idx) => (
               <div key={idx} className="flex flex-col md:flex-row gap-4 items-start md:items-center border-b border-slate-100 pb-4 last:border-0">
                  <div className="w-32 flex-shrink-0 pt-2 md:pt-0">
                     <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                           type="checkbox" 
                           checked={weeklySchedule[idx].active} 
                           onChange={() => toggleDayActive(idx)}
                           className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className={`font-medium ${weeklySchedule[idx].active ? 'text-slate-900' : 'text-slate-400'}`}>
                           {dayName}
                        </span>
                     </label>
                  </div>
                  <div className="flex-1 w-full">
                     <Input 
                        disabled={!weeklySchedule[idx].active}
                        placeholder="e.g. 09:00, 11:00, 13:00 (24h format)"
                        value={weeklySchedule[idx].times}
                        onChange={(e) => updateDayTimes(idx, e.target.value)}
                     />
                     {weeklySchedule[idx].active && (
                        <p className="text-xs text-slate-400 mt-1">Comma separated start times (24h format)</p>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </Card>
    </div>
  );

  const renderAgeGroups = () => (
    <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Age Groups
          </h3>
          <Button variant="secondary" onClick={() => setAgeGroups([...ageGroups, { id: Date.now(), name: 'New Group', teamsCount: 4, gamesPerTeam: 8, gamesPerWeek: 1, duration: 90, color: 'bg-slate-100 text-slate-800' }])}>
            <Plus className="w-4 h-4" /> Add Group
          </Button>
        </div>
        
        {ageGroups.length === 0 ? (
           <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
              <p>No Age Groups defined yet. Click "Add Group" to start.</p>
           </div>
        ) : (
           <div className="grid gap-4">
             {ageGroups.map((group, idx) => (
               <div key={group.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-2">
                     <div className="md:col-span-3">
                        <Input label="Group Name" value={group.name} onChange={e => {
                           const newGroups = [...ageGroups];
                           newGroups[idx].name = e.target.value;
                           setAgeGroups(newGroups);
                        }} />
                     </div>
                     <div className="md:col-span-2">
                        <Input label="Teams" type="number" min="2" value={group.teamsCount} onChange={e => {
                           const newGroups = [...ageGroups];
                           newGroups[idx].teamsCount = parseInt(e.target.value) || 0;
                           setAgeGroups(newGroups);
                        }} />
                     </div>
                     <div className="md:col-span-2">
                        <Input label="Games/Team" type="number" min="1" value={group.gamesPerTeam} onChange={e => {
                           const newGroups = [...ageGroups];
                           newGroups[idx].gamesPerTeam = parseInt(e.target.value) || 0;
                           setAgeGroups(newGroups);
                        }} />
                     </div>
                      <div className="md:col-span-2">
                        <Input label="Games/Week" type="number" min="1" value={group.gamesPerWeek || 2} onChange={e => {
                           const newGroups = [...ageGroups];
                           newGroups[idx].gamesPerWeek = parseInt(e.target.value) || 0;
                           setAgeGroups(newGroups);
                        }} />
                     </div>
                     <div className="md:col-span-2">
                        <Input label="Duration (min)" type="number" min="30" value={group.duration || 90} onChange={e => {
                           const newGroups = [...ageGroups];
                           newGroups[idx].duration = parseInt(e.target.value) || 90;
                           setAgeGroups(newGroups);
                        }} />
                     </div>
                     <div className="md:col-span-1 flex justify-end">
                        <button 
                           onClick={() => setAgeGroups(ageGroups.filter(g => g.id !== group.id))}
                           className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                           <Trash2 className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
               </div>
             ))}
           </div>
        )}
      </Card>
  );

  const renderFields = () => (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" /> Fields & Eligibility
        </h3>
        <Button variant="secondary" onClick={() => setFields([...fields, { id: Date.now(), name: 'New Field', allowedGroups: ageGroups.map(g=>g.id) }])}>
          <Plus className="w-4 h-4" /> Add Field
        </Button>
      </div>

      <div className="space-y-4">
        {fields.length === 0 && (
           <p className="text-slate-400 italic text-sm">No fields added yet.</p>
        )}
        {fields.map((field, idx) => (
          <div key={field.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-4">
              <input 
                className="font-medium text-lg bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full"
                placeholder="Field Name"
                value={field.name}
                onChange={e => {
                   const newFields = [...fields];
                   newFields[idx].name = e.target.value;
                   setFields(newFields);
                }}
              />
              <button 
                onClick={() => setFields(fields.filter(f => f.id !== field.id))}
                className="text-slate-400 hover:text-red-500 ml-2"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-slate-500 py-1">Allowed:</span>
              {ageGroups.length === 0 && <span className="text-xs text-slate-400 py-1">Add Age Groups first</span>}
              {ageGroups.map(group => {
                const isAllowed = field.allowedGroups.includes(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleFieldAllowance(field.id, group.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                      isAllowed 
                        ? (group.color || 'bg-slate-200 text-slate-800') + ' border-transparent' 
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
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
      {/* 1. Add Coaches */}
      <Card className="p-6">
         <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" /> Master Coach List
          </h3>
          <div className="flex gap-2 mb-4">
             <input 
                id="new-coach"
                placeholder="Enter coach name..." 
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                     const val = e.target.value.trim();
                     if(val) {
                       setCoaches([...coaches, { id: `c-${Date.now()}`, name: val }]);
                       e.target.value = '';
                     }
                  }
                }}
             />
             <Button onClick={() => {
                const el = document.getElementById('new-coach');
                if(el.value.trim()) {
                   setCoaches([...coaches, { id: `c-${Date.now()}`, name: el.value.trim() }]);
                   el.value = '';
                }
             }}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
             {coaches.length === 0 && <p className="text-slate-400 italic text-sm">No coaches added yet.</p>}
             {coaches.map(c => (
                <div key={c.id} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                   {c.name}
                   <button onClick={() => setCoaches(coaches.filter(x => x.id !== c.id))} className="text-slate-400 hover:text-red-500">×</button>
                </div>
             ))}
          </div>
      </Card>

      {/* 2. Assign to Teams */}
      <Card className="p-6">
         <div className="mb-4">
             <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" /> Team Rosters & Assignments
            </h3>
            <p className="text-sm text-slate-500 mt-1">
               Edit team names and assign coaches. The scheduler will check these assignments for conflicts.
            </p>
         </div>

         {teams.length === 0 ? (
             <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">
                No teams generated. Go to "Fields & Groups" to add Age Groups and Teams.
             </div>
         ) : (
             <div className="grid gap-6">
                {ageGroups.map(group => (
                   <div key={group.id} className="space-y-3">
                      <h4 className={`font-bold px-3 py-1 rounded-md inline-block text-sm ${group.color || 'bg-slate-200 text-slate-800'}`}>Division: {group.name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                         {teams.filter(t => t.groupId === group.id).map(team => (
                            <div key={team.id} className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors bg-slate-50 group">
                               <div className="relative">
                                  <input 
                                    className="font-medium bg-transparent w-full mb-3 border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none text-slate-900 placeholder-slate-400"
                                    value={team.name}
                                    placeholder="Team Name"
                                    onChange={(e) => {
                                       setTeams(teams.map(t => t.id === team.id ? { ...t, name: e.target.value } : t));
                                    }}
                                  />
                                  <span className="absolute right-0 top-0 text-slate-300 pointer-events-none group-hover:text-slate-400">
                                     ✎
                                  </span>
                               </div>
                               
                               <div className="space-y-2">
                                  <div>
                                     <label className="text-xs font-semibold text-slate-500 uppercase">Head Coach</label>
                                     <select 
                                        className="w-full text-sm mt-1 p-1 border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={team.headCoachId}
                                        onChange={(e) => handleUpdateTeamCoach(team.id, 'headCoachId', e.target.value)}
                                     >
                                        <option value="">-- None --</option>
                                        {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                     </select>
                                  </div>
                                  <div>
                                     <label className="text-xs font-semibold text-slate-500 uppercase">Assistant</label>
                                     <select 
                                        className="w-full text-sm mt-1 p-1 border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={team.asstCoachId}
                                        onChange={(e) => handleUpdateTeamCoach(team.id, 'asstCoachId', e.target.value)}
                                     >
                                        <option value="">-- None --</option>
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
        <div className={`p-4 rounded-lg flex items-start gap-3 ${scheduleStats.unscheduled > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {scheduleStats.unscheduled > 0 ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <div>
            <p className="font-semibold">{scheduleStats.message}</p>
            <p className="text-sm mt-1 opacity-90">
              Scheduled {scheduleStats.scheduled} of {scheduleStats.totalGames} total games.
            </p>
          </div>
        </div>
      )}

      {schedule.length > 0 && (
         <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" /> Export Options
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
                <Button variant="outline" className="text-sm py-1" onClick={exportToICS}>
                   <CalendarCheck className="w-4 h-4" /> Export Calendar (.ics)
                </Button>
                <Button variant="outline" onClick={() => window.print()} className="text-sm py-1">
                   <Download className="w-4 h-4" /> Print View / PDF
                </Button>
            </div>
            
            <div className="border-t border-slate-100 pt-3">
                <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">GameChanger (CSV)</h5>
                <div className="flex flex-wrap gap-2">
                   <Button variant="secondary" className="text-sm py-1" onClick={() => exportToGameChanger(null)}>
                      Export All
                   </Button>
                   <div className="w-px h-6 bg-slate-200 mx-1 self-center hidden md:block"></div>
                   {ageGroups.map(group => (
                      <Button 
                        key={group.id} 
                        variant="secondary" 
                        className="text-sm py-1"
                        onClick={() => exportToGameChanger(group.id)}
                      >
                         {group.name}
                      </Button>
                   ))}
                </div>
            </div>
         </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
         {schedule.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
               <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
               <p>No schedule generated yet. Click "Generate" to start.</p>
            </div>
         ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                     <tr>
                        <th className="p-4">Date & Time</th>
                        <th className="p-4">Field</th>
                        <th className="p-4">Division</th>
                        <th className="p-4">Matchup</th>
                        <th className="p-4 hidden md:table-cell">Coaches (Head/Asst)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {schedule.map((game) => {
                        const group = ageGroups.find(g => g.id === game.groupId);
                        return (
                           <tr key={game.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4">
                                 <div className="font-medium text-slate-900">{game.displayDate}</div>
                                 <div className="text-slate-500">{game.time}</div>
                              </td>
                              <td className="p-4">
                                 <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-semibold">
                                    {game.fieldName}
                                 </span>
                              </td>
                              <td className="p-4">
                                 <span className={`px-2 py-1 rounded text-xs font-semibold ${group?.color || 'bg-gray-100 text-gray-800'}`}>
                                    {group?.name}
                                 </span>
                              </td>
                              <td className="p-4">
                                 <div className="font-medium">{game.teamA.name} <span className="text-slate-400 mx-1">vs</span> {game.teamB.name}</div>
                              </td>
                              <td className="p-4 hidden md:table-cell text-xs text-slate-500">
                                 <div className="grid grid-cols-2 gap-x-4">
                                    <div>
                                       <span className="font-semibold text-slate-700">Home:</span> 
                                       {[coaches.find(c=>c.id===game.teamA.headCoachId)?.name, coaches.find(c=>c.id===game.teamA.asstCoachId)?.name].filter(Boolean).join(', ') || '-'}
                                    </div>
                                    <div>
                                       <span className="font-semibold text-slate-700">Away:</span>
                                       {[coaches.find(c=>c.id===game.teamB.headCoachId)?.name, coaches.find(c=>c.id===game.teamB.asstCoachId)?.name].filter(Boolean).join(', ') || '-'}
                                    </div>
                                 </div>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         )}
      </div>
    </div>
  );

  const tabs = [
    { id: 'setup', label: '1. Season Setup', icon: Calendar },
    { id: 'fields', label: '2. Fields & Groups', icon: Users }, // Merged concept slightly
    { id: 'coaches', label: '3. Coaches & Teams', icon: UserCheck },
    { id: 'schedule', label: '4. Schedule', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <h1 className="font-bold text-xl tracking-tight text-slate-800">LeagueScheduler<span className="text-blue-600">Pro</span></h1>
           </div>
           
           {activeTab !== 'schedule' && (
             <Button onClick={generateSchedule} disabled={isGenerating}>
               {isGenerating ? 'Calculating...' : 'Generate Schedule'}
               <ChevronRight className="w-4 h-4" />
             </Button>
           )}
           {activeTab === 'schedule' && (
              <Button variant="secondary" onClick={generateSchedule} disabled={isGenerating}>
                 Regenerate
              </Button>
           )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           {activeTab === 'setup' && renderSetup()}
           {activeTab === 'fields' && (
              <div className="space-y-6">
                {renderAgeGroups()}
                {renderFields()}
              </div>
           )}
           {activeTab === 'coaches' && renderCoaches()}
           {activeTab === 'schedule' && renderSchedule()}
        </div>

      </main>
    </div>
  );
}