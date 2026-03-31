'use client';

// ============================================================
// app/vote/page.tsx
// Votación secreta — Soporta Modo Mesa e Individual
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useLocalPlayer } from '@/lib/hooks/useLocalPlayer';
import { playHandoff, playSelect, playTransition, playSound } from '@/lib/sounds';

type VoteStep = 'handoff' | 'voting' | 'waiting';

export default function VotePage() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { playerId: localPlayerId } = useLocalPlayer();

  const isIndividual = state.config.mode === 'individual';
  const alivePlayers = state.players.filter((p) => p.isAlive);

  // Orden de pase (fijo)
  const voterOrderIds = state.fixedPassOrder.filter(id => state.players.find(p => p.id === id)?.isAlive);

  const [voterIdx, setVoterIdx] = useState(0);
  const [step, setStep] = useState<VoteStep>(isIndividual ? 'voting' : 'handoff');
  const [selected, setSelected] = useState<string | null>(null);

  // Votos acumulados (solo relevante en modo mesa o si simulamos todo en un dispositivo)
  const [collectedVotes, setCollectedVotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.players.length === 0) {
      router.replace('/');
    }
  }, [state.players.length, router]);

  useEffect(() => {
    void playSound('game.voteStart');
  }, []);

  if (state.players.length === 0) {
    return null;
  }

  const currentVoterId = isIndividual ? localPlayerId : voterOrderIds[voterIdx];
  const currentVoter = state.players.find(p => p.id === currentVoterId);
  const isLastVoter = isIndividual ? false : voterIdx === voterOrderIds.length - 1;

  if (!currentVoter) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <p>Esperando identidad del votante...</p>
      </main>
    );
  }

  const votableTargets = alivePlayers.filter((p) => p.id !== currentVoter.id);

  function advance(targetId: string) {
    if (!currentVoter) return; // TS GUARD

    if (isIndividual) {
      // En modo individual real, aquí se mandaría el voto al servidor
      dispatch({ type: 'CAST_VOTE', voterId: currentVoter.id, targetId: targetId });
      setStep('waiting');
      // Simulamos que al cabo de un tiempo todos votaron y vamos a resolución
      setTimeout(() => {
        playTransition();
        dispatch({ type: 'NEXT_PHASE' });
        router.push('/resolution');
      }, 3000);
    } else {
      const newVotes = { ...collectedVotes, [currentVoter.id]: targetId };
      setCollectedVotes(newVotes);

      if (isLastVoter) {
        Object.entries(newVotes).forEach(([vid, tid]) => {
          dispatch({ type: 'CAST_VOTE', voterId: vid, targetId: tid });
        });
        playTransition();
        dispatch({ type: 'NEXT_PHASE' });
        router.push('/resolution');
      } else {
        setVoterIdx(idx => idx + 1);
        setStep('handoff');
        setSelected(null);
      }
    }
  }

  // --- Pantallas ---

  if (step === 'waiting') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="card">
          <div style={{ fontSize: 44, marginBottom: 16 }}>📩</div>
          <h3>Voto enviado</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>Esperando a que los demás terminen de votar...</p>
          <div className="loading-bar" style={{ marginTop: 24 }}><div className="loading-bar-progress" /></div>
        </div>
      </main>
    );
  }

  if (!isIndividual && step === 'handoff') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)', alignItems: 'center' }}>
          <div className="phase-badge">Votación Secreta</div>
          <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🗳️</div>
          <h2>Pasá el dispositivo</h2>
          <p>Es el turno de <strong style={{ color: 'var(--accent)' }}>{currentVoter.name}</strong></p>
          <p className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>{voterIdx + 1} de {voterOrderIds.length} jugadores</p>
          <button
            className="btn btn-primary"
            style={{ minWidth: 200 }}
            onClick={() => {
              playHandoff();
              setStep('voting');
            }}
          >
            Soy {currentVoter.name} — Votar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">🗳️ Votación</div>
        {!isIndividual && (
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
            {voterIdx + 1}/{voterOrderIds.length}
          </span>
        )}
      </div>

      <div className="page-content">
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 8 }}>
            <div className="player-avatar" style={{ borderColor: 'var(--accent)' }}>{currentVoter.name[0]?.toUpperCase()}</div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Votante</div>
              <div style={{ fontWeight: 700 }}>{currentVoter.name}</div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Elegí a quién querés expulsar. Tu voto es secreto.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {votableTargets.map((player) => {
            const isChosen = selected === player.id;
            return (
              <button
                key={player.id}
                className={`player-card ${isChosen ? 'selected danger-selected' : ''}`}
                onClick={() => {
                  playSelect();
                  setSelected(player.id);
                }}
                style={{ textAlign: 'left' }}
              >
                <div className="player-avatar" style={{ borderColor: isChosen ? 'var(--danger)' : undefined }}>{player.name[0]?.toUpperCase()}</div>
                <span className="player-name">{player.name}</span>
                {isChosen && <span style={{ color: 'var(--danger)', marginLeft: 'auto' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="page-footer">
        <button
          className="btn btn-danger"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            void playSound('game.voteCast');
            advance(selected);
          }}
        >
          {isLastVoter || isIndividual ? 'Confirmar voto →' : 'Votar y continuar →'}
        </button>
      </div>
    </main>
  );
}
