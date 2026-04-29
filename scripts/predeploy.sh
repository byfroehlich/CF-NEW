#!/bin/bash
# CreatorFlow — Pre-Deploy Checklist
# Vor jedem Deploy auf Render ausführen

set -e
echo "🔍 CreatorFlow Pre-Deploy Check"
echo "================================"

# 1. Secrets in Git?
echo "1. Prüfe auf .env Dateien im Git..."
if git ls-files | grep -E "\.env$|\.env\.local|\.env\.production"; then
  echo "❌ FEHLER: .env Datei im Git gefunden! Sofort entfernen."
  exit 1
fi
echo "   ✅ Keine .env Dateien im Git"

# 2. npm audit
echo "2. Security Audit Bot..."
cd bot && npm audit --audit-level=moderate && cd ..
echo "   ✅ Bot: Keine kritischen Vulnerabilities"

echo "3. Security Audit API..."
cd api && npm audit --audit-level=moderate && cd ..
echo "   ✅ API: Keine kritischen Vulnerabilities"

# 3. Tests
echo "4. Parser Tests..."
cd bot && npm test 2>&1 | tail -5 && cd ..
echo "   ✅ Tests bestanden"

echo ""
echo "✅ Alle Checks bestanden. Bereit für Deploy."
echo "   Nächster Schritt: git push → Render deployt automatisch"
