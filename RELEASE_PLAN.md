# Release Plan — the-third-eye v1.0.0

> **Ce fichier est un guide interne. Ne pas le push dans le repo public.**

---

## 1. Vérifications finales avant push

- [ ] Le projet compile en Release sans warnings :
  ```bash
  cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
  cmake --build build
  ```
- [ ] L'agent démarre et répond :
  ```bash
  ./build/the_third_eye.exe --port 9100 --interval 2
  curl http://127.0.0.1:9100/metrics
  curl http://127.0.0.1:9100/api/status
  ```
- [ ] L'UI se lance et affiche les données :
  ```bash
  cd ui && npm install && npm run dev
  ```
- [ ] `start.bat` fonctionne (lance agent + UI)
- [ ] Aucun fichier sensible dans l'arborescence (tokens, clés, `.env`)
- [ ] Aucun chemin absolu dans le code (`C:\Users\...`)
- [ ] `summary.md` : décider si on le garde (doc interne) ou on le retire

---

## 2. Initialisation du repo Git

```bash
cd C:\Users\tlmdev\CLionProjects\the-third-eye

git init
git add .

# Vérifier ce qui sera commité (pas de build/, node_modules/, .idea/)
git status

# Si des fichiers indésirables apparaissent, ajuster .gitignore puis :
git rm -r --cached <dossier>

git commit -m "feat: initial release v1.0.0

- C++ agent with CPU, memory, system collectors
- Prometheus /metrics endpoint + JSON REST API
- Electron desktop UI (dashboard, logs, settings, diagnostics)
- Agent health status (healthy/degraded/unhealthy)
- Runtime config via /api/config"
```

---

## 3. Convention de commits (Conventional Commits)

Format : `<type>: <description>`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `refactor` | Refactoring sans changement fonctionnel |
| `build` | Build system, dépendances |
| `chore` | Maintenance, config |

Exemples :
```
feat: add disk usage collector
fix: correct CPU usage calculation on single-core systems
docs: update API endpoint documentation
```

---

## 4. Tag v1.0.0

```bash
git tag -a v1.0.0 -m "v1.0.0 — Initial public release

System monitoring agent (C++) + Electron desktop UI.
CPU, memory, system metrics. Prometheus-compatible.
Windows-first, localhost-only."

git log --oneline --decorate -5  # Vérifier le tag
```

---

## 5. Création du repo GitHub

### Option A : via GitHub CLI
```bash
gh repo create the-third-eye --public --source=. --remote=origin --push
```

### Option B : via le site
1. Aller sur https://github.com/new
2. Nom : `the-third-eye`
3. Description : `System monitoring agent (C++) + Electron desktop UI — Prometheus-compatible, Windows-first`
4. Public, **sans** README/LICENSE/gitignore (déjà créés)
5. Puis :
```bash
git remote add origin https://github.com/tlmreact/the-third-eye.git
git branch -M main
git push -u origin main
git push origin v1.0.0
```

---

## 6. Rédaction de la Release GitHub

### Via GitHub CLI
```bash
gh release create v1.0.0 \
  --title "v1.0.0 — Initial Release" \
  --notes-file RELEASE_NOTES.md \
  ./build/the_third_eye.exe
```

### Via le site
1. Aller sur Releases → **Draft a new release**
2. Tag : `v1.0.0`
3. Titre : `v1.0.0 — Initial Release`
4. Corps (template ci-dessous)
5. Attacher le binaire `the_third_eye.exe` (depuis `build/`)

### Template Release Notes

```markdown
# The Third Eye v1.0.0 — Initial Release

System monitoring agent for Windows + Electron desktop dashboard.

## Highlights

- **Agent** — C++20 headless process collecting CPU, memory, and system metrics
- **Prometheus endpoint** — `/metrics` in standard text format
- **JSON API** — `/api/status`, `/api/logs`, `/api/config`
- **Electron UI** — real-time dashboard, log viewer, settings, diagnostics
- **Health monitoring** — healthy / degraded / unhealthy status
- **Runtime config** — change interval and log level without restart

## Quick Start

1. Download `the_third_eye.exe` from the assets below
2. Run: `the_third_eye.exe --port 9100 --interval 2`
3. Open: http://127.0.0.1:9100/metrics
4. For the UI: clone the repo, `cd ui && npm install && npm run dev`

## Requirements

- Windows 10/11
- Node.js ≥ 18 (for the UI only)

## Known Limitations

- Windows only (v1 scope)
- Localhost only (127.0.0.1)
- No persistent storage
- No TLS (acceptable for localhost)

## Links

- [README](./README.md) — full documentation
- [API Reference](./README.md#api-endpoints)
```

### Que mettre dans les assets de la release

| Asset | Inclure ? |
|-------|-----------|
| `the_third_eye.exe` | ✅ Oui — binaire standalone |
| Code source (auto) | ✅ GitHub l'ajoute automatiquement |
| `ui/` packagé | ❌ Non pour v1 — les users clonent le repo |
| Logs, build intermediates | ❌ Jamais |

---

## 7. Post-publication

- [ ] Vérifier que le README s'affiche correctement sur GitHub
- [ ] Ajouter les **topics** au repo : `monitoring`, `prometheus`, `windows`, `electron`, `cpp`, `system-monitor`
- [ ] Écrire une description courte dans les settings du repo
- [ ] Activer **Issues** (désactiver Wiki et Discussions si pas besoin)
- [ ] Vérifier que la release est visible sur la page Releases
- [ ] Tester le download du `.exe` depuis la release

---

## 8. Gestion des branches (pour la suite)

| Branche | Usage |
|---------|-------|
| `main` | Code stable, toujours déployable |
| `dev` | Développement actif (optionnel, si contribution) |
| `feature/*` | Branches par fonctionnalité |
| `release/X.Y.Z` | Préparation de release (si nécessaire) |

Pour v1.0.0, une seule branche `main` suffit.

---

## 9. Versioning (pour les futures releases)

Format : [Semantic Versioning](https://semver.org/) `MAJOR.MINOR.PATCH`

| Changement | Version bump |
|------------|-------------|
| Bug fix | `1.0.1` |
| Nouvelle feature (rétrocompatible) | `1.1.0` |
| Breaking change | `2.0.0` |

---

## 10. Checklist finale "Release v1.0.0 Ready"

### Code
- [ ] Compile sans warnings en Release
- [ ] Agent démarre et collecte des métriques
- [ ] Tous les endpoints répondent (`/metrics`, `/api/status`, `/api/logs`, `/api/config`)
- [ ] Health status fonctionne (healthy/degraded/unhealthy)
- [ ] UI affiche le dashboard correctement
- [ ] `start.bat` lance le tout

### Build
- [ ] Build reproductible (`cmake -B build ... && cmake --build build`)
- [ ] Binaire standalone (pas de DLL manquantes grâce à `-static`)
- [ ] `npm install && npm run dev` fonctionne dans `ui/`

### Documentation
- [ ] `README.md` à jour et complet
- [ ] `LICENSE` présent (MIT)
- [ ] Pas de TODO/FIXME oubliés dans le code

### Repo Hygiene
- [ ] `.gitignore` en place
- [ ] Pas de `build/`, `node_modules/`, `.idea/`, `dist/` dans le repo
- [ ] Pas de fichiers sensibles (`.env`, tokens, clés)
- [ ] Pas de chemins absolus dans le code

### Release GitHub
- [ ] Tag `v1.0.0` créé et poussé
- [ ] Release créée avec notes et binaire
- [ ] Topics ajoutés au repo
- [ ] README visible et bien formaté sur GitHub

### Test utilisateur
- [ ] Un utilisateur peut cloner le repo, builder l'agent et lancer l'UI
- [ ] Un utilisateur peut télécharger le `.exe` depuis la release et le lancer
