# Vibe Code Workflow (v1.0)

**Doel:** Eenvoudige, voorspelbare samenwerking zonder conflicts.

---

## 📋 Stappenplan

### 1️⃣ Jij vraagt
Vertel **exact** wat moet gebeuren:
- Welk bestand?
- Welke wijziging?
- Eventuele voorwaarden?

✅ **Goed:** *"Pas in `src/components/ChatInput.tsx` de paste-knop aan: vervang 'Paste' door 'Plakken' en maak de tekst groen (#22c55e)"*
❌ **Slecht:** *"Maak het mooier"*

---

### 2️⃣ Ik werk
- Maak een **nieuwe branch**: `vibe/<korte-omschrijving>-<random-id>`
  (bijv. `vibe/plakken-knop-4de0ec`)
- Pas **alleen** de gevraagde wijzigingen toe
- Commit met duidelijke message
- Push naar **mijn branch** op GitHub

---

### 3️⃣ Jij test
```bash
cd /workspace/github__harald666__vibez
git fetch origin
git checkout vibe/<branchnaam>  # bijv. vibe/plakken-knop-4de0ec
# Test hier lokaal
```

---

### 4️⃣ Jij keurt goed of af
- **Goedgekeurd?**
  Stuur: *"Push naar main en maak release vX.Y.Z"*
  → Ik merge naar `main` en tag de nieuwe versie.

- **Afgekeurd?**
  Stuur: *"<branchnaam> is niet goed, pas <specifieke feedback> aan"*
  → Ik pas aan en push **naar dezelfde branch**. Herhaal stap 3.

---

### 5️⃣ Release (optioneel)
Als je zegt: *"Maak release vX.Y.Z"*, dan:
1. Merge naar `main` (als niet al gedaan)
2. Tag met `vX.Y.Z`
3. Push tag naar GitHub

---

## 🚫 Regels
- **Nooit** direct naar `main` pushen zonder jouw goedkeuring.
- **Nooit** `git pull --force` of `git push --force` gebruiken (tenzij jij het vraagt).
- **Altijd** wachten op jouw testresultaat voordat ik verder ga.
- **Altijd** alleen de gevraagde wijzigingen toepassen (geen extra "verbeteringen").

---

## 💬 Voorbeelden

### Vraag:
> *"In `src/App.css` moet de achtergrondkleur van `.chat-container` veranderen naar `#1a1a1a` en de padding naar `12px`"*

### Mijn actie:
1. `git checkout -b vibe/chat-bg-12px-4de0ec`
2. Pas `src/App.css` aan
3. `git commit -m "Update chat container bg color to #1a1a1a and padding to 12px"`
4. `git push origin vibe/chat-bg-12px-4de0ec`
5. **Wacht op jouw testresultaat**

---

### Jij test en zegt:
> *"vibe/chat-bg-12px-4de0ec is goed, push naar main en maak release v1.1.3"*

### Mijn actie:
1. `git checkout main`
2. `git merge vibe/chat-bg-12px-4de0ec`
3. `git tag v1.1.3`
4. `git push origin main --tags`
5. **Klaar!**

---

## ⚡ Snelle commando's voor jou

| Actie | Commando |
|-------|----------|
| Branch ophalen | `git fetch origin && git checkout vibe/<branch>` |
| Terug naar main | `git checkout main` |
| Lokale branch verwijderen | `git branch -D vibe/<branch>` |
| Alle branches zien | `git branch -a` |

---

**Vragen?** Vraag het gewoon. Ik volg deze workflow **altijd**.
