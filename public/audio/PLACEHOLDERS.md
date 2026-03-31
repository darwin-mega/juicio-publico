# Audio placeholders

El sistema de audio ya espera estos archivos:

- `public/audio/ambience/lobby.mp3`
- `public/audio/ambience/match.mp3`
- `public/audio/ui/click.mp3`
- `public/audio/ui/select.mp3`
- `public/audio/ui/confirm.mp3`
- `public/audio/ui/join-room.mp3`
- `public/audio/ui/screen-change.mp3`
- `public/audio/ui/tick.mp3`
- `public/audio/game/start.mp3`
- `public/audio/game/vote-start.mp3`
- `public/audio/game/vote-cast.mp3`
- `public/audio/game/vote-end.mp3`
- `public/audio/game/accusation.mp3`
- `public/audio/game/reveal.mp3`
- `public/audio/game/error.mp3`
- `public/audio/game/phase-transition.mp3`
- `public/audio/game/news-jingle.mp3`
- `public/audio/game/death.mp3`
- `public/audio/game/saved.mp3`
- `public/audio/game/innocent.mp3`
- `public/audio/game/result-town.mp3`
- `public/audio/game/result-killers.mp3`
- `public/audio/roles/assassin.mp3`
- `public/audio/roles/doctor.mp3`
- `public/audio/roles/police.mp3`
- `public/audio/roles/town.mp3`

Estado actual:

- `ambience.lobby` y `ambience.match` usan primero sus rutas nuevas y, si faltan, caen en `public/Music/musica-fondo.mp3`.
- `game.newsJingle` usa primero su ruta nueva y, si falta, cae en `public/Music/noticias.mp3`.
- El resto de claves funciona hoy con síntesis Web Audio como placeholder profesional de baja carga hasta que agregues los assets finales.
