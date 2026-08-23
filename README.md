# VibeZ

Een eenvoudige Linux-desktopclient voor [Mistral Vibe](https://vibe.mistral.ai/). VibeZ opent Vibe in een eigen applicatievenster, zodat je het als gewone desktopapp kunt gebruiken.

> VibeZ is een onafhankelijke desktopclient en is niet verbonden aan of ondersteund door Mistral AI. Voor het gebruik van Vibe heb je mogelijk een Mistral-account nodig.

## Wat het doet

- Opent de officiële Mistral Vibe-webapp in een zelfstandig venster.
- Levert Linux-installatiepakketten als `.deb` en AppImage.
- Controleert in geïnstalleerde versies automatisch op nieuwe GitHub-releases.

## Installeren op Linux

Download de nieuwste `.deb` uit de [releases](https://github.com/harald666/vibez/releases) en open het bestand met je software-installatieprogramma. Na installatie staat **VibeZ** in het toepassingsmenu.

Je kunt het pakket op Debian-, Ubuntu- en Linux Mint-systemen ook vanuit een terminal installeren:

```bash
sudo apt install ./VibeZ_1.0.0_amd64.deb
```

Gebruik je liever geen installatiepakket, download dan de AppImage uit dezelfde release, maak deze uitvoerbaar en start hem:

```bash
chmod +x VibeZ-1.0.0.AppImage
./VibeZ-1.0.0.AppImage
```

## Zelf bouwen

### Vereisten

- Linux
- Een actuele [Node.js LTS-versie](https://nodejs.org/)
- npm (wordt meegeleverd met Node.js)

### Stappen

```bash
git clone https://github.com/harald666/vibez.git
cd vibez
npm install
npm start
```

Maak vervolgens de distributiepakketten met:

```bash
npm run build
```

De gemaakte bestanden staan in `dist/`:

- `VibeZ_<versie>_amd64.deb` — voor Debian, Ubuntu en Linux Mint
- `VibeZ-<versie>.AppImage` — draagbare Linux-versie

## Updates

Een geïnstalleerde versie controleert bij het opstarten op updates via GitHub Releases. Zodra een update is gedownload, wordt VibeZ opnieuw gestart om die te installeren.

## Ontwikkeling

De applicatie is gebouwd met [Electron](https://www.electronjs.org/). De hoofdcode staat in [`main.js`](main.js); deze maakt het toepassingsvenster aan en laadt `https://vibe.mistral.ai/`.

## Licentie

Er is nog geen licentie voor dit project toegevoegd. Voeg een `LICENSE`-bestand toe voordat je derden gebruiksrechten wilt geven.
