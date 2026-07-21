# Recette humaine — Phase 7

Effectuez cette recette dans un navigateur connecté à Orbit. Ne testez aucune
fonction de paper trading ou de live trading : elles restent hors périmètre.

## 1. Création et persistance d’un workflow

1. Ouvrez **Cron Jobs** dans la barre latérale.
2. Cliquez une fois sur **New workflow**.
3. Attendez au plus deux secondes.

Résultat attendu : un bandeau vert `Workflow created. Configure it below, then
save it.` apparaît. Un nouveau workflow portant la date et l’heure apparaît en
tête de la liste de gauche et son panneau de configuration est ouvert.

4. Remplacez son nom par `Recette P7` et la description par `Test manuel`.
5. Choisissez `UTC` et une heure future de quelques minutes.
6. Cliquez sur **Save**, puis actualisez complètement la page (`Ctrl+R` ou
   `Cmd+R`).

Résultat attendu : `Recette P7` est toujours présent, avec les valeurs
enregistrées. La création ne disparaît pas après actualisation.

## 2. Planification et exécution manuelle

1. Cochez l’interrupteur d’activation et cliquez sur **Save**.
2. Cliquez sur **Run now** une seule fois.
3. Ouvrez **Kanban**.

Résultat attendu : une carte de run apparaît dans **Running**, puis dans
**Completed**. Actualisez Kan : la carte reste présente et aucune secondeban
carte identique n’est créée par l’actualisation.

## 3. Approbation humaine

1. Revenez sur `Recette P7` dans **Cron Jobs**.
2. Cochez **Human approval**, puis cliquez sur **Save**.
3. Cliquez sur **Run now**, puis ouvrez **Human Inbox**.

Résultat attendu : une demande `Approve workflow completion` est visible, avec
un risque B et une échéance. Dans Kanban, le run est en attente d’une décision.

4. Cliquez une seule fois sur **Approve**.
5. Actualisez Human Inbox puis Kanban.

Résultat attendu : la demande n’est plus en attente et le run termine. Un
second clic ou une actualisation ne doit pas relancer ni dupliquer le workflow.

## 4. Rejet et expiration

1. Lancez à nouveau `Recette P7` avec l’option **Human approval** activée.
2. Dans Human Inbox, cliquez sur **Reject**.

Résultat attendu : la demande disparaît de la liste en attente et le run se
termine par sa branche de rejet, sans exécution supplémentaire.

Pour vérifier l’expiration, créez un workflow via l’API avec une expiration
courte (au moins 60 secondes), ne répondez pas, puis attendez le prochain cycle
du planificateur (maximum 30 secondes après l’échéance). Résultat attendu : la
demande disparaît de l’Inbox et seule la branche de rejet/expiration continue.

## Critères d’acceptation

La phase 7 est acceptée si les workflows restent présents après actualisation,
les exécutions n’ont pas de doublon, les décisions sont visibles et résolues une
seule fois, et aucun écran ne propose une action paper ou live trading.
