# Habitudes : installation

## Le plus simple (quelques clics)
- **iPhone :** ouvre le lien de l'app dans **Safari**, touche **Partager** puis **Sur l'écran d'accueil**. L'app a son icône, s'ouvre en plein écran et marche sans internet.
- **Windows :** sur la page **Releases** du dépôt GitHub, télécharge **Habitudes-Setup.exe** et double-clique dessus.

Une seule app, deux versions : **Windows** (app de bureau) et **iPhone** (app native).
Les données restent sur chaque appareil. Pour passer de l'un à l'autre : menu **⋯ → Exporter une sauvegarde**, puis **⋯ → Importer une sauvegarde** sur l'autre appareil.

---

## Windows

1. Double-clique sur **Habitudes-Setup.exe**.
2. Windows affiche « Windows a protégé votre ordinateur », car l'app n'est pas signée par un éditeur payant. Clique sur **Informations complémentaires**, puis **Exécuter quand même**.
3. L'installation se fait sans droits administrateur. Elle crée un raccourci sur le Bureau et dans le menu Démarrer.

Tes données sont dans `%APPDATA%\Habitudes\habitudes.json`. Elles sont conservées si tu désinstalles l'app.
Pour désinstaller : Paramètres → Applications → Habitudes.

**Récupérer les données de la version navigateur :** ouvre l'ancien `Habitudes.html`, fais **⋯ → Exporter une sauvegarde**, puis dans l'app : **⋯ → Importer une sauvegarde**.

---

## iPhone (sans Mac)

Apple n'autorise la compilation d'une app iPhone que sur un Mac. Ce projet utilise donc un Mac de GitHub, gratuitement. Tu installes ensuite l'app depuis ton PC Windows.

### 1. Compiler l'app (une seule fois, environ 10 minutes)
1. Crée un compte gratuit sur github.com.
2. Installe **GitHub Desktop** (desktop.github.com). Fais **File → New repository**, nomme-le `habitudes`, puis copie dans ce dossier **tout le contenu** de `habitudes-projet.zip`, y compris le dossier caché `.github`.
3. Dans GitHub Desktop : **Commit to main**, puis **Publish repository**.
4. Sur github.com, ouvre ton dépôt, onglet **Actions**, puis le workflow **Construire les apps** : il se lance tout seul. Sinon, clique sur **Run workflow**.
5. Quand c'est vert, télécharge l'artefact **Habitudes-iPhone** en bas de la page. Dézippe-le pour obtenir **Habitudes.ipa**.

### 2. Installer sur l'iPhone avec Sideloadly (Windows)
1. Installe **iTunes** et **iCloud** depuis le site d'Apple (versions classiques, pas celles du Microsoft Store), puis **Sideloadly** (sideloadly.io).
2. Branche l'iPhone en USB et accepte « Faire confiance à cet ordinateur ».
3. Glisse **Habitudes.ipa** dans Sideloadly, entre ton identifiant Apple, puis clique sur **Start**.
4. Sur l'iPhone :
   - **Réglages → Confidentialité et sécurité → Mode développeur** : active-le (l'iPhone redémarre).
   - **Réglages → Général → VPN et gestion de l'appareil** : touche ton identifiant Apple, puis **Faire confiance**.

### À savoir
- Avec un identifiant Apple **gratuit**, l'app doit être réinstallée **tous les 7 jours**. Sideloadly peut le faire automatiquement si le PC et l'iPhone sont sur le même Wi-Fi. Tes données sont conservées.
- Avec le **programme développeur Apple** (99 €/an), l'app reste valable un an et peut passer par TestFlight.

---

## Structure du projet
- `www/index.html` : l'app (code commun Windows et iPhone)
- `desktop/` : app Windows (Electron). `npm install && npm run build:win` crée `dist/Habitudes-Setup.exe`
- `ios/` : projet Xcode (Capacitor)
- `.github/workflows/build.yml` : compilation automatique iPhone et Windows
