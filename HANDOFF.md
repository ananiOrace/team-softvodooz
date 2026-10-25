# Handoff — Site « L'équipe » en plan-séquence (Soft Vodooz)
Date : 24 octobre 2026 | Langue de travail : français

## 1. Objectif
One-pager d'équipe où **une seule photo ne change jamais** : au scroll, le reste s'assombrit et se floute, la caméra se pose sur une personne qui reste nette et en couleur, sa fiche apparaît, puis on glisse vers la suivante. Fin : dézoom, tout redevient net, chiffres + bouton « Travailler avec nous ». Photo réelle de l'équipe Soft Vodooz (https://softvodooz.com/), **1080 × 768**.

## 2. Contexte du projet
- Emplacement : `/Users/mac2softvodooz/Documents/TEST` — **toujours pas de dépôt git** [confirmé].
- Stack : Next.js 15.5.28 (App Router, Turbopack), React 19.1.0, TypeScript 5, Tailwind **4**, GSAP 3.15 + ScrollTrigger, Lenis 1.3.27, sharp 0.35.5, vitest 5.
- Machine : macOS, Node v22.23.2, pnpm 11.22.0. Aucun paquet Python image (ni cv2, ni numpy, ni rembg, ni torch) [confirmé].
- Le « project root » de l'outillage est le dépôt ReferralCatch : il faut `cd` dans TEST pour tout commande.

## 3. État actuel

**Fait**
- Scène complète et fonctionnelle : `lib/scene.ts` (caméra, 15 tests verts), `components/team-projector.tsx`, `components/team-static.tsx`, `app/*`, `app/globals.css`.
- Photo réelle intégrée : `assets/source/team-photo.jpg` (copie de `public/team.jpeg`) → `public/scene/base.webp` + `base-blur.webp` en 1080 × 768.
- **3 silhouettes découpées** : `public/scene/people/p03.webp`, `p09.webp`, `p10.webp`.
- Découpes décrites en polygones dans `scripts/masks.mjs` (`pnpm masks` les rasterise), cropées par `scripts/build-scene.mjs` selon `box` de `data/team.json`.
- Outils de tracé : `scripts/trace.mjs` (crop + grille), `scripts/preview-mask.mjs` (contour magenta sur la photo).

**En cours**
- Rien à moitié fait. Le trio de test est propre et visible dans l'app.

**Reste à faire**
1. Découper les 7 restantes : `p01`, `p02`, `p04`, `p05`, `p06`, `p07`, `p08`.
2. Remplacer noms / rôles / citations factices par les vrais.
3. Affiner les points de visée `focus` après les premières découpes (cadrage des fiches).

## 4. Décisions prises
- **Caméra = transformation du plateau entier** ; on ne déplace jamais un calque → aucun trou derrière les personnes, chevauchements sans risque.
- **Focus par deux copies** : `base.webp` nette dessous, `base-blur.webp` (floutée + désaturée + assombrie, cuite) dont on anime l'opacité à 0,97, puis silhouette nette par-dessus.
- **`MAX_ZOOM = 1.5`** (multiple du cadrage cover). Source 1080 px : au-delà on voit l'agrandissement. Seule constante à relever si une photo plus grande arrive.
- **`SCENE = { width: 1080, height: 768 }`** : dimensions **natives** de la photo, pour que `box` et les masques tombent au pixel.
- **Masques en polygones versionnés** (pas de PNG édités à la main) : reproductible, corrigeable, diff-able.
- **`<img>` natifs** (pas `next/image`) pour l'alignement au pixel ; `eslint-disable` en tête des composants.
- **Caméra analytique depuis `progress`** (`cameraAt`), pas de timeline GSAP scrubbée : robuste au resize. Lenis ne fait que lisser.
- Version statique servie sous `prefers-reduced-motion`.

## 5. Contraintes et préférences de l'utilisateur
- Répondre et écrire en **français**.
- Données factices assumées pour l'instant, dans l'esprit Soft Vodooz (dev, IA, design).
- 3 personnes de départ choisies « au hasard » : `p09`, `p10`, `p03`.
- Pas de reconstitution du fond par IA générative (décision validée).

## 6. Éléments techniques clés

- `lib/scene.ts` — `SCENE`, `MAX_ZOOM`, `coverScale`, `clampCamera`, `homeCamera`, `focusCamera`, `lerpCamera`, `cameraTransform`, `buildTimeline(count, intro=0.1, outro=0.1)`, `segmentAt`, `cameraAt`, `focusAmount`, `personOpacity`, `cardOpacity`, `introOpacity`, `finaleOpacity`.
- `components/team-projector.tsx` — `ScrollTrigger.create({ start: 'top top', end: () => '+' + Math.round(height * (people.length * 0.9 + 1)), pin: true, onUpdate, onRefresh })` ; `render(progress)` écrit la transformation du plateau, l'opacité du voile (`focusAmount * 0.97`), des silhouettes et des fiches.
- `scripts/masks.mjs` — `MASKS` = `{ id: [ contours [[x,y],…] ] }` en coordonnées scène ; garde `invokedDirectly` pour être importable.
- `scripts/build-scene.mjs` — masque `assets/masks/<id>.png` extrait sur `box`, alpha adouci par `blur(0.8)`, supprime les silhouettes dont le masque a disparu.
- `app/page.tsx` — `availableCutouts()` lit `public/scene/people/*.webp` (au build, à chaque requête en dev).

Commandes exactes :
```
cd /Users/mac2softvodooz/Documents/TEST
pnpm dev                         # http://localhost:3000
pnpm test                        # 15 tests
pnpm typecheck && pnpm lint && pnpm build
pnpm masks                       # polygones -> assets/masks/*.png
pnpm scene:build                 # masques + photo -> public/scene
node scripts/trace.mjs p03       # crop 2x avec grille
node scripts/trace.mjs rect:394,408,280,294.zone
SCALE=4 RECT=920,145,160,150 node scripts/preview-mask.mjs p09
```

Valeurs mesurées [confirmé] :
- 1440 × 900 : cover 1.333, focus 2.0 ; 390 × 844 : cover 1.099, focus 1.649.
- Scroll pinné : ~10 × hauteur de fenêtre.
- Desk (bord de table) à `y ≈ 660` sur la photo ; laptop de `p10` en haut à `y ≈ 623`.

## 7. Points ouverts et pièges
- **10 ou 11 personnes ?** La demande parlait de 11 calques ; **10 personnes visibles** (observation, à confirmer). `teamInfo.claim` a été neutralisée.
- **Qualité des contours** : polygones = approximation. Cheveux/tresses rendus en masse ; `p03` garde un liseré clair sur l'épaule droite (son tee blanc, pas du fond) ; `p10` inclut un mince morceau de dossier de chaise au-dessus de la casquette. Acceptable au niveau de flou actuel, à retoucher si on zoome plus.
- **Ne pas lancer `pnpm build` pendant `pnpm dev`** (même dossier `.next`).
- **Pièges déjà payés** :
  - `create-next-app` refuse un dossier nommé `TEST` (majuscules) ou `_scaffold` (underscore).
  - `[ERR_PNPM_IGNORED_BUILDS]` → `pnpm-workspace.yaml` : `allowBuilds: { unrs-resolver: true, sharp: true, esbuild: true }`.
  - `next/font/google` retiré (réseau au build).
  - `preview-mask.mjs` : le contour ne s'affiche que si les points sont en coordonnées **scène**, pas en coordonnées du crop.
  - Composite sharp : `resize` avant `composite` fait échouer un input plein format — composer puis redimensionner.
  - `p10` est collée à `p03` : sa `box` commence à `x=394`, la frontière tombe sur la limite entre les deux personnes.
- **Mise à jour en prod** : `availableCutouts()` est lu au build ; ajouter un masque exige un rebuild.

## 8. Prochaine action
Découper `p01` (homme à l'extrême gauche, grand contour simple), puis `p04` et `p05` :

```
cd /Users/mac2softvodooz/Documents/TEST
node scripts/trace.mjs p01
# relever les points sur tmp/trace-p01.png, les ajouter dans MASKS (scripts/masks.mjs)
pnpm masks && pnpm scene:build
SCALE=2.5 node scripts/preview-mask.mjs p01   # contour magenta sur la photo
```

Contrôler chaque silhouette sur le composite réel (voile flou + silhouette) avant de passer à la suivante, et faire valider le trio déjà fait avant d'enchaîner les 7 restantes.

## 9. Message de démarrage suggéré
> Lis `/Users/mac2softvodooz/Documents/TEST/HANDOFF.md` (projet « L'équipe », scène photo au scroll, Next 15 + GSAP). La photo et 3 silhouettes sur 10 sont faites. Continue les découpes avec `p01`, puis `p04` et `p05`, en suivant le workflow polygones → `pnpm masks` → `pnpm scene:build` → aperçu, et montre-moi les résultats avant d'attaquer les 4 dernières.
