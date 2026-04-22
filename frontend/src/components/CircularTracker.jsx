import React, { useState } from 'react';

const CircularTracker = ({ data }) => {
  const [tooltip, setTooltip] = useState(null);

  const habits = [
    // Morning (6)
    { name: 'Meditate', getValue: l => l.morning?.meditate },
    { name: 'Make bed', getValue: l => l.morning?.bed },
    { name: 'Brush (AM)', getValue: l => l.morning?.teeth },
    { name: 'Shower', getValue: l => l.morning?.shower },
    { name: 'Gel', getValue: l => l.morning?.gel },
    { name: 'Perfume', getValue: l => l.morning?.perfume },
    // Bad Habits (6) - checked = avoided (good)
    { name: 'No Smoke', getValue: l => l.bad?.smoking?.checked },
    { name: 'Sexual focus', getValue: l => l.bad?.sexual?.checked },
    { name: 'No Socials', getValue: l => l.bad?.social?.checked },
    { name: 'No Phone', getValue: l => l.bad?.phone?.checked },
    { name: 'No Coffee', getValue: l => l.bad?.coffee?.checked },
    { name: 'No Eat Out', getValue: l => l.bad?.eating?.checked },
    // Night (13) — Read removed
    { name: 'Gym', getValue: l => l.night?.gym },
    { name: 'Clean Table', getValue: l => l.night?.cleanTable },
    { name: 'Org Table', getValue: l => l.night?.orgTable },
    { name: 'Brush (Night)', getValue: l => l.night?.teeth },
    { name: 'Shave', getValue: l => l.night?.shave },
    { name: 'Wash Face', getValue: l => l.night?.washFace },
    { name: 'Hot Shower', getValue: l => l.night?.hotShower },
    { name: 'Hygiene', getValue: l => l.night?.hygiene },
    { name: 'Fingernails', getValue: l => l.night?.fingerNails },
    { name: 'Toenails', getValue: l => l.night?.toeNails },
    { name: 'Wise Spend', getValue: l => l.night?.wiseSpend },
    { name: 'Savings', getValue: l => l.night?.saves },
    { name: 'No Sugar', getValue: l => l.night?.noSugar },
    // Extra
    { name: 'Side Hustle', getValue: l => l.hustle?.achieved },
    { name: 'Video Edit', getValue: l => l.video?.achieved },
  ];

  const numDays = data.length;
  const numHabits = habits.length;

  const width = 1000;
  const height = 1000;
  const cx = width / 2;
  const cy = height / 2.2;
  
  const innerRadius = 90;
  const ringWidth = 14;
  const outerRadius = innerRadius + numHabits * ringWidth;

  const startRad = -Math.PI * 0.5;
  const endRad = Math.PI * 1.0;
  const totalAngle = endRad - startRad;
  const angleStep = totalAngle / numDays;

  const p2c = (r, theta) => ({
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta)
  });

  const getArcPath = (r1, r2, a1, a2) => {
    const p1 = p2c(r1, a1);
    const p2 = p2c(r1, a2);
    const p3 = p2c(r2, a2);
    const p4 = p2c(r2, a1);

    return `M ${p1.x} ${p1.y} 
            A ${r1} ${r1} 0 0 1 ${p2.x} ${p2.y} 
            L ${p3.x} ${p3.y} 
            A ${r2} ${r2} 0 0 0 ${p4.x} ${p4.y} 
            Z`;
  };

  const handleMouseEnter = (e, habit, day, isDone, isSubmitted) => {
    const svgRect = e.currentTarget.closest('svg').getBoundingClientRect();
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left - svgRect.left + rect.width / 2,
      y: rect.top - svgRect.top - 8,
      habit: habit.name,
      day: day.dayNum || day.dayName,
      done: isDone,
      submitted: isSubmitted,
    });
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* Draw Cells */}
        {data.map((day, dIdx) => {
          const a1 = startRad + dIdx * angleStep;
          const a2 = startRad + (dIdx + 1) * angleStep;

          return habits.map((habit, hIdx) => {
            const r1 = innerRadius + hIdx * ringWidth;
            const r2 = r1 + ringWidth;
            const path = getArcPath(r1, r2, a1, a2);
            
            const isDone = habit.getValue(day.log);
            const isSubmitted = day.log.isSubmitted;
            const fill = !isSubmitted ? '#2d303a' : (isDone ? '#10b981' : '#ef4444');

            return (
              <path 
                key={`${dIdx}-${hIdx}`} 
                d={path} 
                fill={fill} 
                stroke="#1f2028" 
                strokeWidth="1.5"
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={(e) => handleMouseEnter(e, habit, day, isDone, isSubmitted)}
                onMouseLeave={handleMouseLeave}
              />
            );
          });
        })}

        {/* Draw Day Labels around the outer edge */}
        {data.map((day, dIdx) => {
          const midAngle = startRad + (dIdx + 0.5) * angleStep;
          const labelRadius = outerRadius + 15;
          const p = p2c(labelRadius, midAngle);
          
          return (
            <text 
              key={`day-${dIdx}`} 
              x={p.x} 
              y={p.y} 
              fill="var(--text-primary)" 
              textAnchor="middle" 
              alignmentBaseline="middle"
              fontSize="12"
              fontWeight="bold"
            >
              {day.dayNum || day.dayName}
            </text>
          );
        })}

        {/* Draw Habit Labels */}
        {habits.map((habit, hIdx) => {
          const midRadius = innerRadius + hIdx * ringWidth + ringWidth / 2;
          const labelAngle = startRad - 0.03;
          const p = p2c(midRadius, labelAngle);
          return (
            <text
              key={`habit-${hIdx}`}
              x={p.x}
              y={p.y}
              fill="var(--text-secondary)"
              textAnchor="end"
              alignmentBaseline="middle"
              fontSize="9"
            >
              {habit.name}
            </text>
          );
        })}
        
        {/* Center Text */}
        <text x={cx} y={cy - 10} fill="var(--text-primary)" textAnchor="middle" fontSize="16" fontWeight="bold">
          HABIT RING
        </text>
        <text x={cx} y={cy + 15} fill="var(--text-muted)" textAnchor="middle" fontSize="10">
          Green = Done · Red = Not Done · Grey = No Data
        </text>
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div className="ring-tooltip" style={{
          left: `${tooltip.x}px`,
          top: `${tooltip.y}px`,
        }}>
          <strong>{tooltip.habit}</strong>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Day {tooltip.day}</span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: !tooltip.submitted ? 'var(--text-muted)' : (tooltip.done ? '#10b981' : '#ef4444')
          }}>
            {!tooltip.submitted ? 'No data' : (tooltip.done ? '✓ Done' : '✗ Missed')}
          </span>
        </div>
      )}
    </div>
  );
};

export default CircularTracker;
