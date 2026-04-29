# UptimeRobot Setup — CreatorFlow Monitoring

## Zweck
UptimeRobot prüft alle 5 Minuten ob API und Bot erreichbar sind.
Bei Ausfall: sofortige Benachrichtigung per Telegram und E-Mail.

## Schritt 1 — Account anlegen
1. uptimerobot.com → kostenloser Account
2. E-Mail bestätigen

## Schritt 2 — API Monitor anlegen

"New Monitor" → HTTP(s):
- Name: CreatorFlow API
- URL: https://creatorflow-api.onrender.com/health
- Monitoring Interval: 5 minutes
- Monitor Timeout: 30 seconds

## Schritt 3 — Telegram Alert einrichten

1. UptimeRobot Dashboard → "Alert Contacts" → "Add Alert Contact"
2. Type: Telegram
3. Telegram-Bot erstellen (separater Bot für Alerts):
   - BotFather → /newbot → "CreatorFlow Monitor"
   - Token kopieren
4. Chat-ID: deine eigene Telegram-ID (nicht die Creatorin)
5. Alert Contact speichern
6. Monitor bearbeiten → Alert Contact verknüpfen

## Schritt 4 — Render Sleep Problem lösen

Render Free Tier schläft nach 15 Min ein (erste Anfrage dauert ~30 Sek).

Lösung: UptimeRobot pingt die API alle 10 Minuten → bleibt wach.
- Zweiten Monitor anlegen
- URL: https://creatorflow-api.onrender.com/health
- Interval: 10 minutes
- Kein Alert nötig (nur zum Wachhalten)

## Schritt 5 — Bot-Heartbeat überwachen

Der Bot sendet alle 5 Minuten einen Heartbeat in die DB.
Das Admin-Dashboard zeigt "Bot online" wenn Heartbeat < 10 Min.

Zusätzlich: UptimeRobot kann nicht direkt den Bot überwachen
(kein HTTP-Endpoint). Daher ist der Dashboard-Health-Monitor
die primäre Quelle für Bot-Status.

## Kosten

UptimeRobot Free: 50 Monitore, 5-Min-Intervall → vollständig ausreichend.

## Erwartetes Verhalten

- API down → Telegram-Nachricht innerhalb 5-10 Minuten
- API wieder up → Telegram-Nachricht "back up"
- Bot down → nur über Dashboard-Health sichtbar (kein direktes Monitoring)
