/**
 * Category Benchmark & Realistic Division Ranking Engine (Real Online Streamers)
 * Uses real live Twitch streams extracted around the streamer's CCU.
 */

class CategoryBenchmarkEngine {
  constructor() {
    this.leagues = [
      { id: 'CHALLENGER', name: 'Challenger', icon: '🥉', minCCU: 0, maxCCU: 100, color: '#f59e0b', desc: '0 – 100 CCU (Растущие стримы)' },
      { id: 'GROWTH',     name: 'Growth',     icon: '🥈', minCCU: 100, maxCCU: 500, color: '#94a3b8', desc: '100 – 500 CCU (Формирование ядра)' },
      { id: 'PRO',        name: 'Pro',        icon: '🥇', minCCU: 500, maxCCU: 2500, color: '#fbbf24', desc: '500 – 2.5k CCU (Стабильное комьюнити)' },
      { id: 'PREMIER',    name: 'Premier',    icon: '💎', minCCU: 2500, maxCCU: 10000, color: '#38bdf8', desc: '2.5k – 10k CCU (Топ категории)' },
      { id: 'TITAN',      name: 'Titan',      icon: '👑', minCCU: 10000, maxCCU: Infinity, color: '#c084fc', desc: '10k+ CCU (Мега-трансляции)' }
    ];
  }

  getLeague(ccu) {
    const val = Math.max(0, ccu || 0);
    return this.leagues.find(l => val >= l.minCCU && val < l.maxCCU) || this.leagues[0];
  }

  evaluate(rankingReport, categoryData) {
    const currentChannel = (rankingReport.activeChannel || 'Ваш Стрим');
    const currentCCU = rankingReport.state?.meta?.viewersCount || 0;
    const currentScore = rankingReport.scoreOverall || 50;
    const gameName = categoryData?.game || rankingReport.state?.meta?.game || 'Just Chatting';
    
    let peerRivals = [...(categoryData?.peerRivals || [])];
    const globalStreams = categoryData?.globalTop || categoryData?.streams || [];

    // 1. Determine League & Progression
    const currentLeague = this.getLeague(currentCCU);
    const leagueIdx = this.leagues.findIndex(l => l.id === currentLeague.id);
    const nextLeague = this.leagues[leagueIdx + 1] || null;

    let leagueProgressPct = 100;
    if (nextLeague) {
      const range = Math.max(1, currentLeague.maxCCU - currentLeague.minCCU);
      const progress = Math.max(0, currentCCU - currentLeague.minCCU);
      leagueProgressPct = Math.min(Math.max(Math.round((progress / range) * 100), 5), 98);
    }

    // 2. Ensure current user is in peer rivals list
    const userExists = peerRivals.some(r => r.isCurrent || (r.channel && r.channel.toLowerCase() === currentChannel.toLowerCase()));
    if (!userExists && currentChannel) {
      peerRivals.push({
        isCurrent: true,
        channel: currentChannel,
        displayName: currentChannel,
        viewersCount: currentCCU,
        viewers: currentCCU,
        title: rankingReport.state?.meta?.title || 'Ваш эфир',
        game: gameName
      });
    }

    // Sort descending by viewers
    peerRivals.sort((a, b) => (b.viewersCount ?? b.viewers ?? 0) - (a.viewersCount ?? a.viewers ?? 0));

    // Find exact position of user
    const myPos = peerRivals.findIndex(r => r.isCurrent || (r.channel && r.channel.toLowerCase() === currentChannel.toLowerCase()));
    const currentDivisionRank = myPos !== -1 ? myPos + 1 : 1;

    // 3. Competitor directly above
    const rivalAbove = myPos > 0 ? peerRivals[myPos - 1] : null;
    let achievableGoalText = '';

    if (rivalAbove && !rivalAbove.isCurrent) {
      const rivalCCU = rivalAbove.viewersCount ?? rivalAbove.viewers ?? 0;
      const rawDelta = rivalCCU - currentCCU;

      // If rival above is within reasonable distance (< 150 CCU)
      if (rawDelta <= 150 && rawDelta > 0) {
        const chatDelta = (rawDelta * 0.04).toFixed(1);
        achievableGoalText = `🎯 Ближайшая цель: обогнать ${rivalAbove.displayName} (+${rawDelta} CCU или +${chatDelta} msg/s в чате)`;
      } else if (rawDelta > 150) {
        // Attainable step goal within the league
        const stepTarget = Math.max(1, Math.min(Math.ceil(currentCCU * 0.3) + 4, 25));
        const chatDelta = (stepTarget * 0.04).toFixed(1);
        achievableGoalText = `🎯 Ближайшая цель: +${stepTarget} CCU для роста в Лиге ${currentLeague.name} (+${chatDelta} msg/s в чате)`;
      } else {
        achievableGoalText = `🎯 Держите текущий темп удержания для закрепления позиции!`;
      }
    } else {
      if (nextLeague) {
        const toNext = Math.max(1, nextLeague.minCCU - currentCCU);
        achievableGoalText = `👑 Вы лидер группы! Осталось +${toNext} CCU до перехода в Лигу ${nextLeague.name}`;
      } else {
        achievableGoalText = `👑 Топ позиция в группе! Алгоритмический охват на максимуме.`;
      }
    }

    // 4. Algorithmic Efficiency Index
    const efficiencyIndex = Math.min(Math.max(Math.round(currentScore * 1.05), 10), 99);

    return {
      game: gameName,
      league: currentLeague,
      nextLeague,
      leagueProgressPct,
      divisionRank: currentDivisionRank,
      totalInDivisionSample: peerRivals.length,
      efficiencyIndex,
      rivalAbove,
      achievableGoalText,
      peerRivals,
      globalStreams
    };
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CategoryBenchmarkEngine;
} else {
  window.CategoryBenchmarkEngine = CategoryBenchmarkEngine;
}
