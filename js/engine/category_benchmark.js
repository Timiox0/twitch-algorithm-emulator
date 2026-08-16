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
    
    const globalStreams = categoryData?.globalTop || categoryData?.streams || [];
    const peerRivals = categoryData?.peerRivals || [];

    // 1. Determine League & Progression
    const currentLeague = this.getLeague(currentCCU);
    const leagueIdx = this.leagues.findIndex(l => l.id === currentLeague.id);
    const nextLeague = this.leagues[leagueIdx + 1] || null;

    let leagueProgressPct = 100;
    if (nextLeague) {
      const range = currentLeague.maxCCU - currentLeague.minCCU;
      const progress = currentCCU - currentLeague.minCCU;
      leagueProgressPct = Math.min(Math.max(Math.round((progress / range) * 100), 5), 98);
    }

    // 2. Find position in peer rivals list
    const currentDivisionRank = peerRivals.findIndex(r => r.isCurrent || (r.channel && r.channel.toLowerCase() === currentChannel.toLowerCase())) + 1 || (peerRivals.length > 0 ? Math.ceil(peerRivals.length / 2) : 3);

    // 3. Competitor directly above
    const rivalAbove = currentDivisionRank > 1 ? peerRivals[currentDivisionRank - 2] : null;
    let achievableGoalText = '';

    if (rivalAbove && !rivalAbove.isCurrent) {
      const ccuDelta = Math.max(1, rivalAbove.viewers - currentCCU);
      const chatDelta = (ccuDelta * 0.04).toFixed(1);
      achievableGoalText = `🎯 Ближайшая цель: обогнать ${rivalAbove.displayName} (+${ccuDelta} CCU или +${chatDelta} msg/s в чате)`;
    } else {
      if (nextLeague) {
        const toNext = nextLeague.minCCU - currentCCU;
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
