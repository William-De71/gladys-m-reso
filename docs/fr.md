# M réso Grenoble

## Présentation

Cette intégration amène **M réso**, le réseau de trams et de bus de l’agglomération grenobloise, dans Gladys. Elle donne les **prochains départs en temps réel, avec leur retard**, aux arrêts de votre choix (trois dans le formulaire, jusqu’à 10 de plus avec un bouton), filtrés par ligne et direction. Elle suit aussi le **trafic** de six lignes au plus (normal, info trafic, perturbé, très perturbé), avec les messages trafic : travaux, déviations, horaires modifiés. Chaque arrêt et chaque ligne devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes.

Les données viennent de l’**open data officiel de Mobilités M**, le service mobilité du SMMAG, sur `data.mobilites-m.fr` sous licence ODbL : ni compte, ni clé. Elles couvrent M réso et les autres réseaux du territoire (Cars Région Isère, Pays Voironnais, Grésivaudan) : un arrêt M réso donne aussi les départs des autres lignes qui y passent. Chaque arrêt suivi est lu par une requête, toutes les minutes par défaut (toutes les 10 minutes quand aucun arrêt n’annonce rien dans la demi-heure, la nuit). Le trafic est lu toutes les 5 minutes. Les lignes et arrêts des réseaux sont gardés par l’intégration et relus une fois par jour et une fois par semaine.

Un départ est **suivi en temps réel** quand Mobilités M connaît la position du véhicule : son heure estimée et son retard sont donnés. Sinon, c’est l’**horaire théorique**, marqué « (théorique) ». Les **courses supprimées** sont signalées.

C’est une intégration **cloud** : elle contacte `data.mobilites-m.fr`. Rien d’autre ne quitte votre réseau.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Rien d’autre : l’open data de Mobilités M ne demande ni compte ni clé.

## Configuration

| Champ              | Quoi saisir                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Arrêt 1, 2, 3      | Le nom de l’arrêt (« Chavant », « Grenoble Hôtel de Ville ») ou son code (« SEM:GENCHV »).                       |
| Ligne              | Seulement cette ligne : « A », « C1 », « 16 ». Vide : toutes les lignes de l’arrêt.                              |
| Direction          | Seulement les destinations contenant ces mots : « La Poya », « Fontaine \| Seyssins ». Vide : les deux sens.     |
| Lignes suivies     | Les lignes dont vous suivez le trafic, six au plus : « A, B, C1, 16 ».                                           |
| Lecture des arrêts | Toutes les 30 secondes, minutes, 2 minutes ou 5 minutes.                                                         |
| Langue des textes  | Noms des appareils, résumés et sorties des scènes. Les noms d’arrêts et les messages trafic restent en français. |

Le bouton **Chercher un arrêt** donne les arrêts contenant quelques mots, avec leur commune, leur code et leurs lignes (« Chavant (Grenoble) [SEM:GENCHV] → A, C, C1, C4 »). Quand deux communes partagent un nom (« Hôtel de Ville »), saisissez la commune avec le nom (« Grenoble Hôtel de Ville ») ou copiez le code. **Tester la connexion** lit les réseaux, chaque arrêt et chaque ligne tout de suite.

Une ligne s’écrit comme sur le véhicule : « A » à « E » pour les trams, « C1 », « 12 »… Un nom porté par deux réseaux (le « C1 » de M réso et le TER « C1 ») désigne celui de M réso ; pour l’autre, saisissez son code (« SNC:C1 »).

Plus d’arrêts que les trois du formulaire (domicile, travail, école…) : **Ajouter un arrêt** reprend les trois mêmes champs — arrêt, ligne, direction — et suit jusqu’à 10 arrêts de plus. **Lister les arrêts** montre tous les arrêts suivis, numérotés ; **Retirer un arrêt** prend ce numéro (ou le nom). Les arrêts ajoutés sont gardés dans la configuration de Gladys et suivent donc ses sauvegardes.

## Utilisation

### Appareils

Dans l’onglet **Découvrir**, créez les appareils voulus :

- **M réso \<arrêt\>** : le prochain départ en texte (« A → La Poya · 3 min (+2 min de retard) »), l’attente du prochain départ et du suivant (minutes), et le retard du prochain (minutes, publié seulement quand il est suivi en temps réel) ;
- **M réso tram A**, **M réso ligne C1**, **Cars Région ligne T83**… : le trafic en texte (« Trafic perturbé : travaux rue Diderot ») et le nombre de messages trafic en cours.

La nuit, sans aucun départ, les attentes gardent leur dernière valeur.

### Trafic

Mobilités M donne pour chaque ligne un **niveau de service** : normal, perturbé ou très perturbé. C’est l’état de l’appareil ligne, et **info trafic** quand le service est normal mais qu’un message est en cours (travaux de nuit à venir dans la soirée, arrêt déplacé…). Chaque message a une période de validité (« 15/07 04:00 → 19/12 03:00 »), parfois des heures dans la journée (« 21:30–02:00 »), et souvent un document (plan de déviation).

### Widgets du tableau de bord

![Le widget Départs M réso à Gares et le widget Trafic M réso des trams et de lignes de bus (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-m-reso/main/docs/assets/widgets.fr.png)

- **Départs M réso** : les prochains départs d’un arrêt, en compact. Une rangée par ligne et destination, avec ses prochains départs à la suite (« 2 · 17 min »). Une course supprimée s’affiche (« supprimé 21:44 ») et colore la rangée en orange, comme un retard de 5 minutes ou plus. Le réglage **Trajets affichés** fixe le nombre de rangées. Choisissez un arrêt suivi, ou saisissez n’importe quel arrêt (et une ligne) dans les réglages du widget. Avec **Plusieurs arrêts**, un seul widget affiche plusieurs appareils arrêts : les appareils d’un même arrêt sont réunis sous son nom ; pour des arrêts différents, chaque arrêt commence par sa propre rangée.
- **Trafic M réso** : l’état de chaque ligne, puis les messages en cours et ceux des trois prochains jours, avec leur période. Touchez une carte pour le texte complet et le document. Les lignes suivies, celles saisies dans les réglages, ou les cinq lignes de tram si vous n’en suivez aucune.

### Scènes

Déclencheurs, une fois par changement (la première lecture sert seulement de référence) :

- **M réso : départ bientôt** : un départ à un arrêt suivi part dans 2, 3, 5, 10, 15 ou 20 minutes, compté sur son heure estimée en temps réel.
- **M réso : départ supprimé** : une course de l’heure à venir à un arrêt suivi est supprimée.
- **M réso : ligne perturbée** : le niveau de service d’une ligne suivie devient perturbé ou très perturbé.
- **M réso : fin de perturbation** : la ligne retrouve un niveau de service normal.
- **M réso : nouveau message trafic** : Mobilités M publie un message sur une ligne suivie, en cours ou à venir.

Chacun donne une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs (ligne, destination, heure, retard, titre, texte, début et fin…). Les actions **M réso : prochains départs** et **M réso : trafic d’une ligne** renvoient le même genre de valeurs, à mettre dans un message ou à tester dans une condition.

Exemples :

- Quand le tram A vers La Poya part de Victor Hugo dans 5 minutes → allumer la lampe de l’entrée en vert.
- Quand un départ de votre arrêt est supprimé, ou que le C1 est perturbé → envoyer le résumé sur votre téléphone avant de partir.
- Chaque jour de semaine à 7 h 30 → lire les prochains départs de votre arrêt et les faire annoncer par l’enceinte de la cuisine.

### Transport

Cloud uniquement : les données viennent d’internet. Seuls les arrêts que vous suivez sont demandés à l’API de Mobilités M, un par un.

## Dépannage

- **« Inconnu ou ambigu »** : utilisez **Chercher un arrêt**, puis copiez le nom exact (avec sa commune si besoin) ou le code ; pour une ligne, son nom comme sur le véhicule (« A », « C1 », « 16 ») ou son code.
- **« (théorique) » après un départ** : Mobilités M ne suit pas ce véhicule en temps réel ; l’horaire est celui de la fiche horaire.
- **Aucun départ** : la nuit, le réseau dort ; l’arrêt est relu toutes les 10 minutes.
- **« L’open data de Mobilités M ne répond pas »** : l’intégration réessaie à chaque lecture ; les derniers départs restent sur les widgets.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes commençant par « M réso diagnostic » de l’onglet Journaux dans une issue GitHub ou une réponse sur le forum, avec les versions de Gladys et de l’intégration.
