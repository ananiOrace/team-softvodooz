# L'équipe — plan-séquence

Une seule photo, une caméra, dix fiches. Au chargement on voit le bureau entier ;
au scroll le reste s'assombrit et se floute, la caméra se pose sur une personne
qui reste nette et en couleur, sa fiche apparaît, puis on glisse vers la suivante.
À la fin, retour au plan large, chiffres de l'équipe et bouton « Travailler avec nous ».

## Démarrer

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

| Commande | Effet |
| --- | --- |
| `pnpm test` | tests de la géométrie caméra (vitest) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | build de production |
| `pnpm scene:build` | fabrique les calques à partir de la photo |
| `pnpm scene:build --placeholder` | scène neutre, pour travailler sans la photo |

## Comment ça marche

Tous les calques vivent dans un plateau aux dimensions de la photo
(1080 × 768). On ne déplace jamais un calque : c'est le plateau entier qui est
mis à l'échelle et translaté, comme une caméra. Conséquences :

- les découpes restent alignées au pixel près, quel que soit le cadrage ;
- les personnes ne bougent pas, donc **aucun trou n'apparaît derrière elles** ;
- les chevauchements ne posent pas de problème : on ne découpe que la partie
  visible, et rien ne la révèle.

Le focus se joue avec deux copies de la photo superposées :

```
base.webp        la photo nette
base-blur.webp   la même, floutée + désaturée + assombrie   ← opacité animée
people/<id>.webp la partie visible d'une personne, en alpha ← opacité animée
```

Un seul effet est actif : on monte l'opacité du voile flou, et on pose la
silhouette nette par-dessus. Au passage d'une personne à l'autre, les deux
silhouettes se croisent légèrement : l'écran n'est jamais vide de sujet net.

La caméra est calculée dans `lib/scene.ts` (fonctions pures, testées). Le zoom
est plafonné par `MAX_ZOOM` : la source ne fait que 1080 px de large, donc
1,5× au-dessus du cadrage plein est déjà la limite honnête. Les cadrages sont
bornés pour que la photo couvre toujours l'écran — c'est ce qui fait que le même
réglage fonctionne en paysage et en portrait, sans storyboard séparé.

`prefers-reduced-motion` coupe l'animation et sert une version statique : la
photo, puis les fiches en grille.

## La photo et les découpes

1. La photo source est `assets/source/team-photo.jpg` (1080 × 768).
2. `pnpm scene:build` en tire `public/scene/base.webp` et `base-blur.webp`.
3. Chaque silhouette est décrite par un polygone dans `scripts/masks.mjs`,
   en coordonnées de la scène. `node scripts/masks.mjs` (ou `pnpm masks`)
   rasterise ces polygones en `assets/masks/<id>.png`.
4. `pnpm scene:build` découpe alors chaque silhouette sur son rectangle
   (`box` dans `data/team.json`), avec un contour légèrement adouci.

Outils de tracé :

```bash
node scripts/trace.mjs p03              # crop agrandi avec grille
node scripts/trace.mjs rect:394,408,280,294.zone   # zone libre
node scripts/preview-mask.mjs p03       # contour magenta sur la photo
```

Les rectangles `box` et les points de visée `focus` sont les réglages à
affiner : ce sont eux qui décident du cadrage de chaque fiche.

## État actuel

- La vraie photo est intégrée ; les calques de fond en sont issus.
- **3 silhouettes découpées sur 10** : `p09` (homme isolé à droite, contour
  simple), `p10` (assis derrière le laptop, occlusion), `p03` (tresses et
  lunettes, le cas le plus délicat). Les 7 autres restent floues au focus.
- Les noms, rôles et citations sont **factices** (équipe Soft Vodooz), à
  remplacer par les vrais.

## Limites connues

- **Résolution** : 1080 px de large. C'est le plafond de netteté au zoom ; une
  version plus grande de la photo est le seul vrai levier.
- **Nombre** : la photo montre **dix** personnes visibles, pas onze. À confirmer.
- **Contours** : cheveux crépus, tresses et lunettes demanderont des retouches
  manuelles sur les masques.
- `pnpm scene:build` ne régénère pas la liste des découpes côté page : en dev la
  page relit le dossier, en production il faut rebuild après ajout de masques.
