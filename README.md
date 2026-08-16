# 🚀 Twitch Multi-Objective Ranking Algorithm Emulator & OBS Copilot

[![Twitch Algorithm](https://img.shields.io/badge/Algorithm-arXiv%3A2608.04455v1-9146ff?style=for-the-badge&logo=twitch)](https://arxiv.org/html/2608.04455v1)
[![Platform](https://img.shields.io/badge/Platform-OBS%20Studio%20%7C%20Browser-38bdf8?style=for-the-badge&logo=obsstudio)](http://localhost:3000)
[![License](https://img.shields.io/badge/License-MIT-34d399?style=for-the-badge)](LICENSE)

> **Real-Time Stream Optimization & Live Recommendation Score HUD for Twitch Streamers**  
> Based on the Twitch / Amazon Research Paper:  
> *"Multi-Objective Ranking for Live-Streaming: Balancing Fresh and Delayed Signals with Segment-Aware Targeting"* (DOI: `10.1145/3773078.3831867`, arXiv:2608.04455v1).

---

## 📖 Обзор проекта (Overview)

Этот инструмент эмулирует реальный алгоритм ранжирования и рекомендаций Twitch в режиме реального времени. Он подключается к вашему стриму через **Twitch GQL API** и **WebSocket IRC-чат**, извлекает свежие и отложенные сигналы, пропускает их через нейросетевую модель **MMoE (Multi-gate Mixture-of-Experts)** и отображает ваш **Twitch Recommendation Score (0–100)** прямо в оверлее **OBS Studio** или в веб-дашборде.

```
                           [ LIVE STREAM TELEMETRY ]
            (Twitch GQL + IRC Chat WebSockets + Viewer Badges + CCU)
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
     [ Fresh Signal Model (FSM) ]            [ MMoE Delayed Engine (K=4) ]
     • Hook Velocity (1-3m watch)            • p_LMP (Deep Watch Duration)
     • Chat Reactivity & Energy              • p_Chat (Chat Participation)
     • Visual Clarity & Thumbnail            • p_Follow (Follow Retention)
                 │                           • p_Spend (Bits / Sub Intensity)
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      ▼
                      [ Viewer Segment Targeting (VST) ]
                       • Early Viewers (E): 50% SMP + 50% Delayed
                       • Dedicated Core (D): 10% SMP + 90% Delayed
                                      │
                                      ▼
                 [ REAL-TIME TWITCH RECOMMENDATION SCORE ]
                 • 60 FPS OBS Studio Overlay (overlay.html)
                 • 5 Соревновательных Лиг (Дивизионы 0..10k+ CCU)
                 • Кардиограмма стрима & Экспорт отчета в PNG
```

---

## ✨ Ключевые возможности (Key Features)

### 1. 🧠 Математическое ядро на базе исследования arXiv:2608.04455v1
* **Fresh Signal Model (FSM)**: расчет вероятности немедленного удержания зрителя ($p_{SMP}$).
* **Multi-gate Mixture-of-Experts (MMoE)**: 4 специализированные экспертные нейросети с softmax-гейтингом под задачи $p_{LMP}$ (длинный просмотр), $p_{Chat}$ (активность чата), $p_{Follow}$ (конверсия в фолловеры) и $p_{Spend}$ (монетизация).
* **Viewer Segment Targeting (VST)**: динамическое разделение скора для **Early ($E$)** (новички) и **Dedicated ($D$)** (ядро канала).

### 2. 🌐 Прямая интеграция с Twitch Live Telemetry
* Подключение к любому открытому каналу без сложных API-ключей.
* Высокочастотный опрос Twitch GQL (каждые 2 секунды) с отслеживанием **динамического тренда онлайна (Live CCU Delta)**: `▲ +3`, `▼ -2`, `● stable`.
* IRC WebSocket клиент с парсингом тегов бейджей (`subscriber`, `vip`, `moderator`, `founder`) для эмпирического разделения новичков и ядра.

### 3. 🏆 Соревновательные дивизионы (Weight-Class Leagues)
Вместо сравнения с недостижимыми гигантами (50k+ CCU), стример соревнуется в своей весовой категории:
* 🥉 **Challenger League** (0 – 100 CCU)
* 🥈 **Growth League** (100 – 500 CCU)
* 🥇 **Pro League** (500 – 2,500 CCU)
* 💎 **Premier League** (2,500 – 10,000 CCU)
* 👑 **Titan League** (10,000+ CCU)
* **Real Online Peer Rivals**: подгрузка реальных стримеров Twitch, находящихся в сети прямо сейчас с близким онлайном.

### 4. 📈 Session Analytics & Кардиограмма стрима
* Поминутная запись динамики Score, CCU, $p_{SMP}$, $p_{LMP}$ и скорости чата.
* Интерактивный график на Canvas 60 FPS со скраббингом.
* Автоматическая детекция событий: 🚀 *Пик виральности*, ⚠️ *Просадка удержания*, 🔥 *Хайп в чате*, 👑 *Саб-трейн*.
* **Экспорт инфографики (PNG)**: генерация постера 1200x675 в 1 клик для соцсетей/Telegram.

### 5. 🎥 OBS Studio Overlay
* Готовый прозрачный виджет для вставки в OBS как **Browser Source** (`overlay.html`).
* Постоянное сохранение сессии (`localStorage` + `URL Sync`) — сессия не слетает при смене сцен или перезагрузке OBS.

---

## 🚀 Быстрый старт (Quick Start)

### Требования
* **Node.js** v18.0 или выше.

### Установка и запуск

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/Timiox0/twitch-algorithm-emulator.git
   cd twitch-algorithm-emulator
   ```

2. Запустите локальный сервер:
   * **Windows**: двойной клик по [`start_widget.bat`](start_widget.bat)
   * **Или через терминал**:
     ```bash
     node server.js
     ```

3. Откройте в браузере:
   * **Панель управления**: [http://localhost:3000/](http://localhost:3000/)
   * **OBS Оверлей**: [http://localhost:3000/overlay.html?channel=ВАШ_КАНАЛ](http://localhost:3000/overlay.html?channel=ВАШ_КАНАЛ)

---

## 🎥 Настройка оверлея в OBS Studio

1. В OBS Studio в панели **«Источники»** нажмите **`+`** $\rightarrow$ **«Браузер» (Browser Source)**.
2. Укажите URL:
   ```
   http://localhost:3000/overlay.html?channel=ВАШ_НИКНЕЙМ
   ```
3. Установите размеры:
   * **Ширина**: `400`
   * **Высота**: `480`
4. Включите галочку **«Обновлять браузер, когда сцена становится активной»**.

---

## 🧪 Тестирование и верификация

В репозиторий включены автоматические тесты:

```bash
# Проверка математики алгоритма (FSM + MMoE + VST)
node test_algorithm.js

# Проверка лиг и дивизионов
node test_divisions.js

# Проверка рекордера сессии и детектора событий
node test_session_analytics.js

# Проверка живого пайплайна Twitch GQL
node test_real_pipeline.js
```

---

## 📜 Лицензия (License)

Проект распространяется под лицензией **MIT License**. Свободно для использования и модификации.
