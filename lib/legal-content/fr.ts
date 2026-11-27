import type { LegalLanguagePack } from "./types";

/** Version française (2.0). Mêmes sections que la version anglaise. */
export const fr: LegalLanguagePack = {
  profile: () => ({
    heading: "Informations sur le vendeur",
    rows: [
      ["Nom commercial", "ESIMPROVE"],
      ["Exploitant", "ESIMPROVE est une marque en ligne exploitée par une personne physique. Ce n'est pas une société immatriculée."],
      ["Nom légal de l'exploitant", "Pas encore publié. Il sera ajouté ici avant l'activation des paiements par carte."],
      ["Pays d'exploitation", "Viêt Nam (lieu d'exploitation provisoire)"],
      ["Adresse postale", "Pas encore publiée. Il n'y a pas de bureau ouvert au public ; le service fonctionne en ligne."],
      ["Numéro d'entreprise / de TVA", "Aucun. ESIMPROVE ne détient ni ne revendique de numéro d'immatriculation ou de TVA."],
      ["E-mail (assistance, réclamations, données personnelles)", "{email}"],
      ["Téléphone", "Pas de ligne téléphonique. L'assistance se fait par e-mail."],
    ],
    note: "Nous ne publions que des informations vérifiables. Les informations manquantes sont indiquées comme non publiées plutôt qu'inventées.",
    translationNote:
      "Ce document existe en anglais, français, espagnol et arabe, avec le même sens. En cas de divergence, la version anglaise s'applique, sauf disposition contraire de la loi de votre pays, et toute ambiguïté réelle est interprétée en votre faveur.",
  }),

  docs: {
    terms: () => ({
      title: "Conditions générales de vente et d'utilisation",
      description: "Le contrat entre vous et ESIMPROVE : commandes, livraison, paiement, vos droits, usage acceptable et responsabilité.",
      intro:
        "Ces conditions constituent l'accord entre vous et ESIMPROVE lorsque vous utilisez ce site ou achetez un forfait eSIM. Lisez-les avec les documents auxquels elles renvoient (service eSIM, paiement, remboursement et confidentialité). Rien dans ces conditions ne supprime les droits que vous confèrent les lois impératives de protection des consommateurs ou des données de votre pays de résidence.",
      sections: [
        {
          id: "who",
          heading: "1. Qui sommes-nous et comment nous joindre",
          blocks: [
            "ESIMPROVE est une boutique en ligne de forfaits de données eSIM prépayés pour les voyages. C'est une marque en ligne exploitée par une personne physique depuis le Viêt Nam, et non une société immatriculée. Les informations sur le vendeur que nous pouvons publier figurent dans les [mentions légales](/legal/notice).",
            "Vous pouvez nous écrire à {email}. Nous répondons par e-mail ; il n'y a pas de ligne téléphonique.",
          ],
        },
        {
          id: "documents",
          heading: "2. Documents qui forment notre accord",
          blocks: [
            "Lorsque vous passez commande, les documents suivants s'appliquent dans la version affichée lors du paiement :",
            {
              ul: [
                "les présentes conditions générales ;",
                "les [conditions du service eSIM et de livraison](/legal/esim-service) (compatibilité, couverture, activation et validité) ;",
                "les [conditions de paiement](/legal/payments) (carte et USDT) ;",
                "la [politique de remboursement, d'annulation et de rétractation](/legal/refunds).",
              ],
            },
            "La [politique de confidentialité](/legal/privacy) et la [politique relative aux cookies](/legal/cookies) expliquent comment nous traitons les données personnelles. Ce sont des notices d'information, pas des clauses contractuelles que vous acceptez.",
            "La version acceptée est enregistrée avec votre commande. Les modifications ultérieures ne s'appliquent qu'aux commandes suivantes, sauf si la loi en dispose autrement.",
          ],
        },
        {
          id: "eligibility",
          heading: "3. Qui peut acheter",
          blocks: [
            "Vous devez avoir la capacité juridique de conclure un contrat dans votre pays, ce qui suppose en général d'être majeur. Le service ne s'adresse pas aux enfants.",
            "Vous ne devez pas acheter ni utiliser le service si la loi ou des sanctions internationales qui vous concernent, ou qui nous concernent, l'interdisent.",
          ],
        },
        {
          id: "service",
          heading: "4. Ce que nous vendons",
          blocks: [
            "Nous vendons des forfaits de données eSIM prépayés pour les voyages. Un forfait donne un volume de données pour une durée indiquée, dans les pays listés sur la page du forfait. Sauf mention contraire sur la page du forfait, les forfaits sont **uniquement data** : ils n'incluent pas de numéro de téléphone, d'appels ni de SMS, et **ne permettent pas d'appeler les services d'urgence**.",
            "Les données mobiles sont fournies par un grossiste eSIM et acheminées par des réseaux mobiles locaux. ESIMPROVE est le vendeur avec qui vous contractez. Nous ne sommes pas un opérateur de réseau mobile. Les [conditions du service eSIM](/legal/esim-service) expliquent les conséquences sur la couverture, le débit et la disponibilité.",
            "Avant d'acheter, vérifiez que votre appareil prend en charge l'eSIM et n'est pas verrouillé par un opérateur, à l'aide du [guide de compatibilité](/compatibility) et des détails du forfait.",
          ],
        },
        {
          id: "prices",
          heading: "5. Prix",
          blocks: [
            "Les prix sont affichés en dollars américains (USD). Le total affiché lors du paiement est le total que vous payez à ESIMPROVE. Nous n'ajoutons aucun frais après la commande et aucun supplément selon le moyen de paiement choisi. Pour les paiements par carte, Apple Pay et Google Pay, notre prestataire de paiement (Whop) peut ajouter la taxe de vente ou la TVA applicable dans votre pays ; elle est affichée dans le formulaire de paiement avant le paiement.",
            "Pour un paiement en USDT, le total est converti au taux de 1 USDT = 1 USD. Un montant unique d'au plus 0,0099 USDT (moins d'un cent américain) est ajouté pour identifier votre transfert. Voir les [conditions de paiement](/legal/payments).",
            "Votre banque, l'émetteur de votre carte, votre portefeuille ou votre plateforme d'échange peut facturer ses propres frais, par exemple de conversion de devises ou de réseau blockchain (gas). Ces frais relèvent de votre relation avec ce prestataire.",
            "En cas d'erreur de prix manifeste, nous vous prévenons avant la livraison de l'eSIM. Vous pouvez alors confirmer la commande au bon prix ou l'annuler et être remboursé intégralement.",
          ],
        },
        {
          id: "order",
          heading: "6. Comment une commande devient un contrat",
          blocks: [
            {
              ol: [
                "Vous choisissez un forfait, vérifiez le récapitulatif et le total, et acceptez les présentes conditions.",
                "Vous demandez la fourniture immédiate de l'eSIM et reconnaissez l'effet de cette demande sur votre droit de rétractation (voir la section 9).",
                "Vous cliquez sur **Commande avec obligation de paiement**.",
                "Le contrat est conclu lorsque votre paiement est confirmé : pour une carte, lorsque le prestataire de paiement l'approuve ; pour l'USDT, lorsque le transfert est vérifié sur BNB Smart Chain.",
              ],
            },
            "Nous pouvons refuser une commande avant la confirmation du paiement, par exemple si un forfait est momentanément indisponible ou si la commande semble frauduleuse. Si nous refusons une commande après votre paiement, nous vous remboursons intégralement.",
            "Le paiement est désactivé pour un forfait lorsque notre fournisseur ne peut pas l'honorer à ce moment-là. Ainsi, nous n'encaissons jamais un paiement pour une eSIM que nous ne pouvons pas livrer.",
          ],
        },
        {
          id: "delivery",
          heading: "7. Livraison",
          blocks: [
            "Dès que le paiement est confirmé, nous commandons automatiquement votre eSIM auprès de notre fournisseur. Les détails de l'eSIM sont généralement disponibles en quelques minutes, avec le code QR et les informations d'installation manuelle. Ils s'affichent sur la page de votre commande (via le lien sécurisé affiché après le paiement) et dans votre compte si vous en avez un.",
            "Si le fournisseur ne peut pas émettre l'eSIM, votre paiement reste en sécurité et la commande est examinée par une personne. Nous livrons alors l'eSIM ou vous remboursons intégralement. Une commande n'est jamais indiquée comme livrée si le fournisseur n'a pas réellement émis l'eSIM.",
          ],
        },
        {
          id: "your-responsibilities",
          heading: "8. Vos responsabilités",
          blocks: [
            {
              ul: [
                "Indiquez une adresse e-mail correcte et protégez votre lien de commande et votre compte : toute personne disposant du lien ou du code QR peut tenter d'installer l'eSIM.",
                "Vérifiez la compatibilité de votre appareil et les détails du forfait (pays, données, validité, date limite d'activation) avant d'acheter.",
                "Suivez les instructions d'installation et ne supprimez pas l'eSIM avant la fin du forfait. De nombreuses eSIM ne peuvent être installées qu'une seule fois.",
                "Respectez les lois des pays où vous voyagez et les [règles d'usage acceptable](#acceptable-use).",
              ],
            },
          ],
        },
        {
          id: "withdrawal",
          heading: "9. Votre droit de rétractation",
          blocks: [
            "Dans l'Union européenne, au Royaume-Uni et dans certains autres pays, les consommateurs disposent en principe de 14 jours pour se rétracter d'un achat en ligne. Pour les contenus et services numériques, la loi permet de commencer la fourniture immédiatement si vous le demandez et reconnaissez perdre ce droit une fois le contenu ou le service fourni.",
            "Lors du paiement, nous vous demandons de confirmer que vous souhaitez recevoir l'eSIM immédiatement. Vous reconnaissez aussi perdre le droit de vous rétracter pour simple changement d'avis une fois l'eSIM **installée ou activée**. Jusque-là, vous pouvez annuler et être remboursé intégralement (voir la [politique de remboursement](/legal/refunds)).",
            "Si la loi de votre pays considère un forfait eSIM comme un service dont on peut se rétracter dans les 14 jours même après son début, nous respectons ce droit. Vous ne payez alors que la part du forfait déjà utilisée, comme expliqué dans la politique de remboursement.",
          ],
        },
        {
          id: "faults",
          heading: "10. En cas de problème",
          blocks: [
            "Si votre eSIM ne fonctionne pas comme décrit en raison d'un problème de notre côté ou de celui de notre fournisseur, contactez-nous. Nous vous aiderons à résoudre le problème, puis nous fournirons une eSIM de remplacement fonctionnelle ou un remboursement total ou partiel selon ce qui a été fourni. Cela ne limite aucun recours que votre loi locale vous accorde pour les produits ou services numériques défectueux ou non conformes.",
          ],
        },
        {
          id: "acceptable-use",
          heading: "11. Usage acceptable",
          blocks: [
            "Vous ne devez pas utiliser le site ou une eSIM :",
            {
              ul: [
                "pour toute activité illégale, notamment la fraude, le blanchiment d'argent ou le contournement de sanctions ;",
                "pour envoyer du spam, attaquer des réseaux ou des systèmes, ou perturber d'autres utilisateurs ;",
                "pour revendre ou redistribuer des eSIM à titre commercial sans notre accord écrit ;",
                "en dépassant les limites d'usage raisonnable indiquées sur la page du forfait ou appliquées par le réseau (par exemple serveurs, trafic automatisé ou « SIM box ») ;",
                "avec un moyen de paiement volé, le portefeuille d'autrui sans autorisation, ou de fausses informations ;",
                "pour sonder, aspirer ou surcharger le site, ou contourner sa sécurité.",
              ],
            },
            "Les réseaux peuvent ralentir, restreindre ou interrompre un usage qui enfreint leurs règles. Nous pouvons refuser ou annuler des commandes liées à une fraude ou à un abus.",
          ],
        },
        {
          id: "suspension",
          heading: "12. Suspension et fermeture de compte",
          blocks: [
            "Nous pouvons suspendre un compte ou refuser le service en cas de manquement grave aux présentes conditions, de soupçon de fraude ou d'obligation légale. Lorsque c'est possible, nous vous en expliquons la raison et vous permettons de répondre. Si nous interrompons un service payé alors que vous n'êtes pas en faute, nous remboursons la partie non utilisée.",
            "Vous pouvez fermer votre compte à tout moment en nous contactant ou via le [formulaire de demande relative aux données](/privacy/request).",
          ],
        },
        {
          id: "liability",
          heading: "13. Notre responsabilité",
          blocks: [
            "Nous sommes tenus de fournir le forfait eSIM tel que décrit, avec soin et compétence raisonnables.",
            "Rien dans ces conditions ne limite notre responsabilité en cas de décès ou de dommage corporel causé par notre négligence, de fraude, ou pour tout ce qui ne peut légalement être limité.",
            "La couverture mobile dépend des réseaux locaux. Nous ne sommes pas responsables des pertes que nous ne pouvions raisonnablement prévoir au moment de la commande, des pertes professionnelles (un forfait grand public est destiné à un usage personnel) ni des interruptions dues à des événements échappant à notre contrôle raisonnable (section 14). Sous réserve du paragraphe précédent, si nous sommes responsables d'une perte, notre responsabilité est limitée au prix payé pour la commande concernée. Cette limite ne réduit aucun recours légal dont vous disposez en tant que consommateur.",
          ],
        },
        {
          id: "force-majeure",
          heading: "14. Événements indépendants de notre volonté",
          blocks: [
            "Nous ne sommes pas responsables des retards ou défaillances causés par des événements que nous ne pouvions raisonnablement empêcher, par exemple des pannes de réseau, des restrictions publiques des services mobiles, des catastrophes naturelles, une guerre ou une défaillance du réseau blockchain. Si un tel événement nous empêche de livrer un forfait payé, nous vous remboursons.",
          ],
        },
        {
          id: "complaints",
          heading: "15. Réclamations et litiges",
          blocks: [
            "Contactez-nous d'abord à {email} : la plupart des problèmes se règlent rapidement. Notre procédure de réclamation et nos délais de réponse figurent dans les [mentions légales](/legal/notice#complaints).",
            "Vous pouvez aussi saisir l'autorité de protection des consommateurs ou un organisme de règlement extrajudiciaire des litiges (médiateur) de votre pays. La plateforme européenne de règlement en ligne des litiges a fermé le 20 juillet 2025 ; nous n'y renvoyons donc pas.",
          ],
        },
        {
          id: "law",
          heading: "16. Droit applicable et tribunaux",
          blocks: [
            "Ces conditions sont régies par le droit du Viêt Nam, où ESIMPROVE est exploitée. Si vous êtes consommateur, vous conservez la protection des règles impératives de votre pays de résidence et pouvez agir devant les tribunaux de ce pays lorsque la loi le permet.",
          ],
        },
        {
          id: "changes",
          heading: "17. Modifications",
          blocks: [
            "Nous pouvons mettre à jour ces conditions, par exemple pour tenir compte d'évolutions légales ou de notre service. La nouvelle version porte un nouveau numéro et une nouvelle date. Elle ne s'applique qu'aux commandes passées après sa publication. Nous ne modifierons pas les conditions d'une commande déjà passée sans votre accord.",
          ],
        },
      ],
    }),

    esim: () => ({
      title: "Conditions du service eSIM et de livraison",
      description: "Compatibilité, couverture, activation, validité, livraison et ce qui se passe si une eSIM ne peut pas être livrée.",
      intro:
        "Cette page explique le fonctionnement et les limites des forfaits eSIM d'ESIMPROVE, pour vous aider à choisir le forfait adapté à votre voyage. Elle fait partie de nos [conditions générales](/legal/terms).",
      sections: [
        {
          id: "what",
          heading: "1. Qu'est-ce qu'un forfait eSIM",
          blocks: [
            "Une eSIM est une carte SIM numérique que vous installez sur un téléphone, une tablette ou un autre appareil compatible, en scannant un code QR ou en saisissant des informations à la main. Nos forfaits sont des forfaits de données mobiles prépayés pour les voyages. Chaque page de forfait indique les pays couverts, le volume de données, la durée de validité, les réseaux, la règle d'activation et la date limite d'activation.",
            "Sauf mention contraire sur la page du forfait, les forfaits sont **uniquement data** : pas de numéro de téléphone, d'appels ni de SMS, et **impossible d'appeler les numéros d'urgence**. Prévoyez un autre moyen de joindre les secours.",
          ],
        },
        {
          id: "compatibility",
          heading: "2. Compatibilité et déverrouillage de l'appareil",
          blocks: [
            "Votre appareil doit :",
            {
              ul: [
                "prendre en charge l'eSIM (certains modèles vendus dans certaines régions ne la prennent pas en charge, même si le même modèle le fait ailleurs) ;",
                "être **désimlocké**, c'est-à-dire ne pas être verrouillé sur un opérateur ;",
                "prendre en charge les bandes de fréquences utilisées dans votre destination.",
              ],
            },
            "Consultez le [guide de compatibilité](/compatibility) et les réglages de votre appareil avant d'acheter. Nos informations de compatibilité sont indicatives ; le fabricant et votre opérateur ont le dernier mot. Si vous découvrez que votre appareil est incompatible **avant** d'installer l'eSIM, nous vous remboursons intégralement.",
          ],
        },
        {
          id: "coverage",
          heading: "3. Couverture, réseaux et débit",
          blocks: [
            {
              ul: [
                "Les forfaits utilisent des réseaux partenaires dans chaque pays. Les réseaux disponibles et l'accès à la 4G/5G dépendent du réseau local et du lieu. La couverture peut être plus faible à l'intérieur des bâtiments, en sous-sol, en mer, en vol et dans les zones isolées.",
                "Le débit n'est pas garanti. Il dépend du réseau, de la congestion, de votre appareil et des règles d'usage raisonnable du forfait. Certains forfaits réduisent le débit après un volume quotidien (la page du forfait l'indique).",
                "Votre trafic internet peut transiter par un autre pays. Les sites web peuvent alors voir un pays différent de celui où vous vous trouvez.",
                "Certains pays restreignent certaines applications ou certains services (par exemple les appels par internet). Nous ne contrôlons pas ces restrictions locales.",
              ],
            },
          ],
        },
        {
          id: "validity",
          heading: "4. Activation, validité et données",
          blocks: [
            {
              ul: [
                "**Début de la validité.** La page du forfait indique si la validité commence à l'installation de l'eSIM ou à sa première connexion à un réseau compatible dans un pays couvert.",
                "**Date limite d'activation.** La plupart des forfaits doivent être activés dans un délai donné après l'achat (souvent 180 jours), indiqué sur la page du forfait. Passé ce délai, un forfait non utilisé expire.",
                "**Données.** Un forfait à volume total prend fin lorsque les données ou la validité sont épuisées, selon la première échéance. Un forfait quotidien donne un volume par jour ; au-delà, le débit est réduit ou le service est suspendu jusqu'au lendemain, comme indiqué sur la page du forfait. Les données non utilisées ne sont ni reportées ni remboursées au prorata.",
                "**Recharges.** ESIMPROVE ne vend pas de recharges pour le moment. Si vous avez besoin de plus de données, achetez un nouveau forfait.",
              ],
            },
          ],
        },
        {
          id: "install",
          heading: "5. Installer votre eSIM",
          blocks: [
            {
              ol: [
                "Installez l'eSIM avant de partir, connecté au Wi-Fi : scannez le code QR de votre page de commande ou saisissez à la main l'adresse SM-DP+ et le code d'activation.",
                "Ne supprimez pas l'eSIM après l'installation : de nombreuses eSIM ne peuvent être installées qu'une seule fois, et une eSIM supprimée peut être irrécupérable.",
                "À l'arrivée, sélectionnez l'eSIM pour les données mobiles et activez l'**itinérance des données** pour cette ligne.",
                "Gardez votre code QR confidentiel : toute personne qui le possède peut installer l'eSIM avant vous.",
              ],
            },
          ],
        },
        {
          id: "delivery",
          heading: "6. Délais de livraison",
          blocks: [
            "Nous commandons votre eSIM auprès de notre fournisseur dès la confirmation du paiement. Les détails de l'eSIM apparaissent généralement sur votre page de commande en quelques minutes. Un paiement par carte est confirmé lorsque le prestataire l'approuve. Un paiement en USDT est confirmé après 15 confirmations sur BNB Smart Chain, ce qui prend normalement moins d'une minute après votre transfert.",
            "Nous n'envoyons pas encore l'eSIM par e-mail. Conservez le lien sécurisé affiché après le paiement, ou créez un compte pour retrouver vos eSIM dans **Mes eSIM**.",
          ],
        },
        {
          id: "failure",
          heading: "7. Si une eSIM ne peut pas être livrée ou activée",
          blocks: [
            {
              ul: [
                "Si notre fournisseur ne peut pas émettre votre eSIM (par exemple en cas de rupture de stock), votre commande est mise en attente pour être examinée par une personne, et votre paiement reste en sécurité. Nous livrons ensuite l'eSIM ou vous remboursons intégralement. Une commande n'est jamais marquée comme livrée sans de vrais détails d'eSIM fournis par le fournisseur.",
                "Si l'eSIM est émise mais ne se connecte pas, contactez-nous avec votre numéro de commande. Nous vérifierons son statut auprès du fournisseur, vous aiderons à résoudre le problème, puis la remplacerons ou la rembourserons si le problème vient de nous ou du fournisseur.",
                "Si l'activation échoue parce que l'appareil est incompatible ou verrouillé, ou parce que l'eSIM a été supprimée, un remboursement peut être impossible une fois l'eSIM installée. Voir la [politique de remboursement](/legal/refunds).",
              ],
            },
          ],
        },
        {
          id: "supplier",
          heading: "8. Dépendance envers le fournisseur et les réseaux",
          blocks: [
            "Les profils eSIM sont émis par notre grossiste, et le service est acheminé par des réseaux locaux. Leur maintenance, leurs pannes ou leurs changements peuvent interrompre le service. Si une interruption empêche d'utiliser un forfait payé comme décrit, nous proposons un remplacement ou un remboursement de la partie concernée.",
          ],
        },
      ],
    }),

    payments: () => ({
      title: "Conditions de paiement",
      description: "Fonctionnement des paiements par carte et en USDT (BEP-20), moment où une commande est payée, et traitement des paiements erronés, tardifs ou partiels.",
      intro:
        "Cette page explique les moyens de paiement acceptés par ESIMPROVE, le moment où votre commande est considérée comme payée et la gestion des problèmes de paiement. Elle fait partie de nos [conditions générales](/legal/terms).",
      sections: [
        {
          id: "methods",
          heading: "1. Moyens de paiement",
          blocks: [
            {
              ul: [
                "**Carte bancaire.** Les paiements par carte (et Apple Pay ou Google Pay si votre appareil les prend en charge) sont traités par notre prestataire de paiement, Whop, dans son formulaire sécurisé affiché dans notre page de paiement. Le formulaire de Whop demande les informations nécessaires pour traiter et sécuriser le paiement, comme votre adresse e-mail, vos données de carte et vos nom, pays et adresse de facturation. Elles sont transmises directement à Whop selon sa propre politique de confidentialité ; ESIMPROVE ne voit ni ne conserve jamais votre numéro de carte.",
                "**USDT (BEP-20) sur BNB Smart Chain.** La seule cryptomonnaie acceptée est le Tether USD (USDT), sous forme de jeton BEP-20 sur BNB Smart Chain (chain ID 56). L'adresse du contrat du jeton est 0x55d398326f99059fF775485246999027B3197955.",
              ],
            },
            "Aucun moyen de paiement n'entraîne de frais supplémentaires.",
          ],
        },
        {
          id: "usdt-amount",
          heading: "2. Calcul du montant en USDT",
          blocks: [
            "Les prix sont en dollars américains. Pour l'USDT, nous appliquons un taux fixe de **1 USDT = 1 USD**, sans taux de marché ni marge de change.",
            "Pour associer automatiquement votre transfert à votre commande, nous ajoutons au total un montant unique d'**au plus 0,0099 USDT** (moins d'un cent américain). Le montant exact à envoyer s'affiche sur la page de paiement avant tout envoi.",
            "Les éventuels frais de réseau (gas) de BNB Smart Chain sont à votre charge ; votre portefeuille les affiche avant confirmation. Le montant qui arrive à notre adresse doit être exactement celui affiché. Si vous envoyez depuis une plateforme d'échange, vérifiez que ses frais de retrait ne sont pas déduits de ce montant.",
          ],
        },
        {
          id: "usdt-how",
          heading: "3. Comment payer en USDT",
          blocks: [
            {
              ol: [
                "Après avoir cliqué sur **Commande avec obligation de paiement**, la page de paiement affiche l'adresse de réception, le réseau (BNB Smart Chain, BEP-20) et le montant exact en USDT.",
                "Envoyez exactement ce montant, en un seul transfert, sur BNB Smart Chain, dans un délai de **30 minutes**.",
                "Nous détectons le transfert automatiquement. Vous pouvez aussi coller le hash de la transaction sur la page de paiement.",
                "La commande est marquée **payée** une fois que le transfert a **15 confirmations de bloc** et qu'il a été vérifié de façon indépendante : bon jeton, bon réseau, bonne adresse et montant exact.",
              ],
            },
            {
              callout:
                "Les transferts blockchain sont irréversibles. Vérifiez le réseau (BNB Smart Chain / BEP-20), le jeton (USDT) et l'adresse avant d'envoyer. Nous ne vous demanderons jamais d'envoyer vers une autre adresse ou un autre réseau, ni votre clé privée ou votre phrase de récupération.",
            },
          ],
        },
        {
          id: "paid",
          heading: "4. Quand une commande est-elle payée",
          blocks: [
            {
              ul: [
                "**Carte :** lorsque le prestataire de paiement nous confirme un paiement réussi.",
                "**USDT :** lorsqu'un transfert du montant exact vers notre adresse atteint 15 confirmations sur BNB Smart Chain pendant le délai de paiement.",
              ],
            },
            "Une transaction indiquée « envoyée » dans votre portefeuille ne signifie pas à elle seule que la commande est payée. La page de commande affiche le statut en cours.",
          ],
        },
        {
          id: "problems",
          heading: "5. Paiements USDT erronés, tardifs, partiels ou en double",
          blocks: [
            {
              table: {
                caption: "Ce qui se passe dans chaque cas",
                head: ["Situation", "Ce que nous faisons"],
                rows: [
                  ["**Paiement insuffisant** (moins que le montant exact)", "La commande n'est pas payée automatiquement. Votre transfert est enregistré et examiné par une personne. Contactez-nous : vous pouvez envoyer le complément ou demander le remboursement de la somme envoyée."],
                  ["**Paiement excédentaire** (plus que le montant exact)", "La commande est examinée par une personne. Nous livrons la commande et vous remboursons l'excédent, ou remboursons la totalité si vous le préférez."],
                  ["**Paiement tardif** (après les 30 minutes)", "Nous continuons de détecter les transferts tardifs pendant 24 heures. Un transfert tardif n'est jamais perdu : il est enregistré et examiné, puis nous livrons la commande ou vous remboursons."],
                  ["**Paiement en double**", "Nous remboursons intégralement le paiement en trop."],
                  ["**Mauvais réseau ou mauvais jeton** (par exemple de l'USDT sur une autre blockchain, ou une autre cryptomonnaie)", "Ces transferts ne sont pas détectés. Contactez-nous avec le hash de la transaction. Si les fonds sont arrivés sur une adresse que nous contrôlons et que nous pouvons les récupérer en toute sécurité, nous vous les restituons. Des fonds envoyés à une adresse que nous ne contrôlons pas, ou sur un réseau auquel nous n'avons pas accès, peuvent être définitivement perdus : nous ne pouvons pas annuler un transfert blockchain."],
                  ["**Mauvaise adresse**", "Les fonds envoyés à une autre adresse que celle de votre page de paiement ne nous parviennent pas, et nous ne pouvons pas les récupérer."],
                ],
              },
            },
          ],
        },
        {
          id: "crypto-refunds",
          heading: "6. Remboursements en USDT",
          blocks: [
            {
              ul: [
                "Les remboursements sont versés en USDT (BEP-20) sur BNB Smart Chain. Ils sont calculés en dollars américains au même taux de 1 USDT = 1 USD : la valeur remboursée ne dépend pas des variations du marché.",
                "Nous remboursons vers le portefeuille d'où provient le paiement, sauf si vous nous indiquez une autre adresse BNB Smart Chain que vous contrôlez. Les remboursements vers une adresse de dépôt de plateforme d'échange peuvent échouer : prévenez-nous si vous avez payé depuis une plateforme.",
                "Les frais de réseau des remboursements que nous envoyons sont à notre charge.",
                "Les transferts blockchain étant irréversibles, nous pouvons vous demander de confirmer l'adresse de remboursement depuis l'e-mail utilisé pour la commande.",
              ],
            },
          ],
        },
        {
          id: "crypto-notes",
          heading: "7. Informations importantes sur les cryptomonnaies",
          blocks: [
            {
              ul: [
                "L'USDT est un stablecoin émis par une société privée. Ce n'est pas une monnaie ayant cours légal, et sa valeur peut s'écarter d'un dollar américain.",
                "Nous acceptons l'USDT uniquement comme moyen de payer des forfaits eSIM. Nous n'échangeons, ne conservons ni n'investissons de cryptomonnaies pour nos clients, et rien sur ce site ne constitue un conseil financier.",
                "Les transactions blockchain sont publiques. Votre adresse d'envoi et la transaction restent visibles en permanence sur la blockchain (voir la [politique de confidentialité](/legal/privacy)).",
                "Il vous appartient de respecter les règles fiscales et relatives aux cryptomonnaies de votre pays.",
              ],
            },
          ],
        },
        {
          id: "disputes",
          heading: "8. Rétrofacturations et litiges de paiement",
          blocks: [
            "En cas de problème avec un paiement par carte, contactez-nous d'abord : nous pouvons généralement le régler plus vite qu'une rétrofacturation (chargeback). Vous conservez tout droit de contester un paiement par carte auprès de votre banque. En cas de contestation, nous pouvons communiquer au prestataire de paiement les éléments relatifs à la commande, à la livraison et à l'assistance pour y répondre.",
            "Les paiements en cryptomonnaie ne peuvent pas faire l'objet d'une rétrofacturation. Les problèmes de paiement en USDT se règlent directement avec nous, comme décrit ci-dessus.",
          ],
        },
      ],
    }),

    refunds: () => ({
      title: "Politique de remboursement, d'annulation et de rétractation",
      description: "Quand annuler et être remboursé, comment sont calculés les remboursements partiels et comment ils sont versés.",
      intro:
        "Cette politique explique quand vous pouvez annuler une commande eSIM et être remboursé, et comment nous traitons les remboursements. Elle fait partie de nos [conditions générales](/legal/terms). Si la loi de votre pays vous accorde davantage de droits, ce sont ces droits qui s'appliquent.",
      sections: [
        {
          id: "summary",
          heading: "1. En résumé",
          blocks: [
            {
              table: {
                caption: "Quand vous êtes remboursé",
                head: ["Situation", "Remboursement"],
                rows: [
                  ["eSIM ni installée ni activée (pour toute raison, y compris un changement d'avis) et date limite d'activation non dépassée", "Remboursement intégral"],
                  ["Nous n'avons pas pu livrer l'eSIM, ou l'avons livrée en retard et vous n'en voulez plus", "Remboursement intégral"],
                  ["L'eSIM ne fonctionne pas à cause d'un problème de notre côté ou de celui du fournisseur, et nous ne pouvons ni la réparer ni la remplacer", "Remboursement intégral ou partiel (section 4)"],
                  ["Forfait sensiblement différent de sa description (mauvais pays, volume ou validité)", "Remplacement, ou remboursement intégral ou partiel"],
                  ["Paiement en double, ou montant payé supérieur au montant exact", "Remboursement de l'excédent"],
                  ["Changement d'avis après installation ou activation de l'eSIM", "En principe non remboursable (voir toutefois la section 3)"],
                  ["Appareil incompatible ou verrouillé, découvert seulement après l'installation", "En principe non remboursable"],
                ],
              },
            },
          ],
        },
        {
          id: "before",
          heading: "2. Annuler avant l'installation ou l'activation",
          blocks: [
            "Vous pouvez annuler pour n'importe quelle raison et être remboursé intégralement tant que l'eSIM n'a **pas été installée ni activée** et que sa date limite d'activation n'est pas dépassée. Nous vérifions le statut de l'eSIM auprès de notre fournisseur avant de rembourser. Une fois le remboursement accepté, nous annulons l'eSIM, qui ne peut plus être utilisée.",
            "C'est plus favorable que le droit de rétractation minimal de 14 jours applicable dans l'UE et au Royaume-Uni, car ce n'est pas limité à 14 jours.",
          ],
        },
        {
          id: "withdrawal",
          heading: "3. Le droit légal de rétractation de 14 jours",
          blocks: [
            "Lors du paiement, vous nous demandez de livrer l'eSIM immédiatement. Vous reconnaissez aussi perdre le droit de vous rétracter pour simple changement d'avis une fois l'eSIM installée ou activée. C'est ainsi que la loi permet de fournir immédiatement un produit numérique.",
            "Si la loi de votre pays vous permet de vous rétracter dans les 14 jours même après le début d'un forfait eSIM (parce qu'il est considéré comme un service), vous pouvez toujours le faire. Vous ne payez alors que ce qui a déjà été fourni. Nous le calculons comme la plus élevée de deux parts, celle des données utilisées et celle de la durée de validité écoulée, et remboursons le reste.",
            "Pour vous rétracter, envoyez-nous une déclaration claire par e-mail ({email}) ou via le formulaire de contact, avec votre numéro de commande. Vous n'avez pas à vous justifier.",
          ],
        },
        {
          id: "faults",
          heading: "4. eSIM défectueuse ou non conforme",
          blocks: [
            "Si une eSIM ne fonctionne pas comme décrit à cause d'un problème de notre côté ou de celui de notre fournisseur, nous essayons d'abord de le résoudre ou de la remplacer. Si ce n'est pas possible dans un délai raisonnable :",
            {
              ul: [
                "si vous n'avez pas du tout pu utiliser le forfait, nous vous remboursons intégralement ;",
                "si vous avez pu en utiliser une partie, nous remboursons la partie non utilisée, calculée comme à la section 3.",
              ],
            },
            "Ne constituent pas un défaut de l'eSIM les problèmes dus à une couverture locale conforme à la description de la page du forfait, à un appareil incompatible ou verrouillé, ou à la suppression de l'eSIM. Nous vous aiderons néanmoins autant que possible.",
          ],
        },
        {
          id: "how",
          heading: "5. Comment demander un remboursement",
          blocks: [
            "Écrivez à {email} ou utilisez la [page de contact](/contact), en indiquant :",
            {
              ul: [
                "votre numéro de commande et l'e-mail utilisé pour la commande ;",
                "ce qui s'est passé et quand, avec les messages d'erreur ou captures d'écran ;",
                "si l'eSIM a été installée ou utilisée ;",
                "pour un remboursement en USDT : l'adresse de portefeuille à rembourser, si elle diffère de celle qui a servi au paiement.",
              ],
            },
            "Ne nous envoyez jamais votre mot de passe, vos codes à usage unique, votre numéro de carte, votre clé privée ou votre phrase de récupération.",
          ],
        },
        {
          id: "processing",
          heading: "6. Comment et quand les remboursements sont versés",
          blocks: [
            {
              ul: [
                "Nous répondons aux demandes de remboursement sous 5 jours ouvrés et versons les remboursements acceptés sous 14 jours.",
                "Les paiements par carte sont remboursés sur la même carte, via le prestataire de paiement. Votre banque peut mettre quelques jours de plus à l'afficher.",
                "Les paiements en USDT sont remboursés en USDT (BEP-20), comme décrit dans les [conditions de paiement](/legal/payments#crypto-refunds). Les frais de réseau du remboursement sont à notre charge.",
                "Si nous refusons une demande, nous expliquons pourquoi et indiquons comment faire une réclamation. Un refus ne supprime jamais un droit que la loi impérative vous accorde.",
              ],
            },
          ],
        },
      ],
    }),

    privacy: (ctx) => ({
      title: "Politique de confidentialité",
      description: "Quelles données personnelles ESIMPROVE collecte, pourquoi, qui les reçoit, combien de temps elles sont conservées et quels sont vos droits.",
      intro:
        "Cette politique explique comment ESIMPROVE traite vos données personnelles lorsque vous utilisez le site, achetez une eSIM, payez ou nous contactez. Nous collectons le strict nécessaire pour vendre et livrer des eSIM et assurer la sécurité du service.",
      sections: [
        {
          id: "controller",
          heading: "1. Responsable du traitement",
          blocks: [
            "Le responsable du traitement est l'exploitant individuel d'ESIMPROVE, une marque en ligne exploitée depuis le Viêt Nam (voir les [mentions légales](/legal/notice)). Pour toute question ou demande relative à vos données, écrivez à {email} ou utilisez le [formulaire de demande](/privacy/request).",
            "ESIMPROVE n'a pas désigné de représentant dans l'Union européenne ni au Royaume-Uni. Vous pouvez nous contacter directement par e-mail, où que vous soyez.",
          ],
        },
        {
          id: "data",
          heading: "2. Données collectées",
          blocks: [
            {
              table: {
                caption: "Données personnelles traitées",
                head: ["Catégorie", "Exemples", "Source"],
                rows: [
                  ["Commande", "e-mail, nom, pays de résidence, forfait, quantité, prix, statut, version des conditions acceptée, votre demande de fourniture immédiate", "Vous, lors du paiement"],
                  ["eSIM", "ICCID, code d'activation / code QR, statut de l'eSIM, date d'expiration", "Notre fournisseur d'eSIM"],
                  ["Paiement par carte", "montant, statut et référence du prestataire. **Nous ne recevons jamais votre numéro de carte.**", "Prestataire de paiement"],
                  ["Paiement en USDT", "adresse du portefeuille émetteur, hash de transaction, montant et confirmations", "BNB Smart Chain (public)"],
                  ["Compte", "nom, e-mail, mot de passe (conservé uniquement sous forme de hachage sécurisé), sessions de connexion", "Vous"],
                  ["Assistance et demandes relatives aux données", "vos messages et nos réponses, statut de la demande", "Vous"],
                  ["Preuves de consentement", "vos choix concernant les cookies et le marketing, et la version des conditions acceptée, horodatés", "Vous"],
                  ["Sécurité", "jetons de session hachés, empreinte de votre adresse réseau calculée avec une clé secrète pour limiter les abus, journaux d'audit", "Votre appareil / nos systèmes"],
                  ["Mesure d'audience (avec consentement uniquement)", "identifiants pseudonymes de visiteur et de session (conservés hachés), pages vues, type d'appareil et de navigateur, pays approximatif", "Votre appareil"],
                ],
              },
            },
            "Nous ne demandons ni pièce d'identité, ni date de naissance, ni localisation précise, ni contacts.",
          ],
        },
        {
          id: "purposes",
          heading: "3. Finalités et bases juridiques",
          blocks: [
            {
              table: {
                caption: "Finalités et bases juridiques",
                head: ["Finalité", "Base juridique (lorsque le droit européen ou britannique s'applique)"],
                rows: [
                  ["Traiter et livrer votre commande, fournir votre eSIM, l'assistance et les remboursements", "Exécution du contrat"],
                  ["Vérifier les paiements et prévenir la fraude et les abus", "Intérêt légitime (protéger les clients et l'activité) ; contrat"],
                  ["Conserver les registres de commandes, paiements et remboursements", "Obligation légale (fiscale et comptable) ; intérêt légitime (gestion des litiges)"],
                  ["Gérer votre compte et sa sécurité", "Contrat ; intérêt légitime (sécurité)"],
                  ["Mesure d'audience facultative", "Consentement, retirable à tout moment"],
                  ["E-mails marketing facultatifs", "Consentement ; désinscription possible à tout moment"],
                  ["Répondre aux demandes relatives aux données et aux réclamations juridiques", "Obligation légale ; intérêt légitime"],
                ],
              },
            },
            "Lorsque la loi de votre pays exige votre consentement pour un usage donné, nous vous le demandons, et vous pouvez le retirer à tout moment. Ce retrait ne remet pas en cause les traitements effectués auparavant.",
          ],
        },
        {
          id: "recipients",
          heading: "4. Destinataires",
          blocks: [
            "Nous ne partageons des données qu'avec les prestataires qui nous aident à faire fonctionner le service, et uniquement ce dont chacun a besoin :",
            {
              table: {
                caption: "Prestataires",
                head: ["Prestataire", "Rôle", "Données"],
                rows: [
                  ["Netlify (États-Unis)", "Hébergement du site", "Données techniques nécessaires à l'affichage du site"],
                  ["Neon (base de données hébergée sur Amazon Web Services, États-Unis)", "Base de données", "Les données décrites à la section 2"],
                  ["eSIM Access (notre grossiste eSIM)", "Émission des profils eSIM", "Le forfait commandé et une référence de transaction anonyme. **Nous n'envoyons pas votre nom ni votre e-mail au fournisseur.**"],
                  ["NodeReal (fournisseur de données blockchain)", "Lecture de BNB Smart Chain pour vérifier les paiements en USDT", "Requêtes portant sur notre adresse de réception et des hash de transaction (données publiques de la blockchain)"],
                  ["Whop (prestataire de paiement par carte)", "Traitement des paiements par carte, Apple Pay et Google Pay", "Données saisies dans son formulaire de paiement (e-mail, carte et facturation), avec la référence et le montant de la commande. La politique de confidentialité de Whop s'applique également."],
                  ["Google et Apple (connexion facultative)", "Vous connectent si vous choisissez Continuer avec Google ou Apple", "Votre identifiant de compte chez ce fournisseur, votre e-mail vérifié et votre nom"],
                  ["Resend (envoi d'e-mails, lorsqu'il est activé)", "Envoie des e-mails facultatifs de commande et d'eSIM", "Votre adresse e-mail et le contenu du message"],
                  ...(ctx.ga4Configured
                    ? [["Google (Google Analytics 4)", "Mesure d'audience facultative, avec consentement uniquement", "Cookies de mesure d'audience et données d'utilisation"]]
                    : []),
                ],
              },
            },
            "Nous ne vendons pas vos données personnelles et ne les utilisons pas pour du profilage publicitaire. Nous pouvons communiquer des données si la loi l'exige, pour constater ou défendre des droits en justice, ou pour prévenir la fraude.",
            "**Blockchain publique.** Si vous payez en USDT, votre transaction (y compris votre adresse d'envoi et le montant) est inscrite de façon permanente sur BNB Smart Chain, qui est publique. Personne, nous compris, ne peut l'effacer.",
          ],
        },
        {
          id: "transfers",
          heading: "5. Transferts internationaux",
          blocks: [
            "ESIMPROVE est exploitée depuis le Viêt Nam, et nos principaux prestataires stockent les données aux États-Unis. Vos données sont donc transférées hors de votre pays. Lorsque la loi exige des garanties pour ces transferts, nous nous appuyons sur les conditions de traitement des données proposées par nos prestataires, y compris des clauses contractuelles types lorsqu'elles sont disponibles. Contactez-nous pour en savoir plus.",
          ],
        },
        {
          id: "retention",
          heading: "6. Durées de conservation",
          blocks: [
            {
              ul: [
                "Commandes, paiements, remboursements et factures : aussi longtemps que l'exige la législation fiscale et comptable, et tant qu'un litige reste possible.",
                "Détails des eSIM : aussi longtemps que la commande correspondante, pour pouvoir vous assister et traiter les remboursements.",
                "Données de compte : tant que votre compte existe. À votre demande, nous les supprimons ou les anonymisons, sauf les données que la loi nous oblige à conserver.",
                "Messages d'assistance : le temps de traiter votre demande, plus une durée raisonnable pour les questions de suivi.",
                "Mesure d'audience : pseudonyme ; le consentement expire après 180 jours au plus.",
                "Sessions et données de limitation des abus : jusqu'à leur expiration seulement.",
              ],
            },
          ],
        },
        {
          id: "rights",
          heading: "7. Vos droits",
          blocks: [
            "Selon votre lieu de résidence, vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation de leur traitement ou leur portabilité, vous opposer aux traitements fondés sur l'intérêt légitime et retirer votre consentement. Utilisez le [formulaire de demande](/privacy/request) ou écrivez à {email}. Nous pouvons être amenés à vérifier votre identité. Nous répondons dans un délai d'un mois, ou plus tôt si la loi de votre pays l'exige.",
            "Vous pouvez aussi introduire une réclamation auprès de l'autorité de protection des données de votre pays (en France, la CNIL). Nous apprécierions de pouvoir d'abord répondre à votre préoccupation.",
            "Nous ne prenons aucune décision fondée exclusivement sur un traitement automatisé produisant des effets juridiques ou significatifs à votre égard. Les contrôles automatiques, comme la vérification des paiements ou la limitation des abus, servent uniquement à vérifier qu'un paiement correspond ou qu'une requête est autorisée. Une personne examine tout cas problématique.",
          ],
        },
        {
          id: "security",
          heading: "8. Sécurité et violations de données",
          blocks: [
            "Nous protégeons les données par des mesures telles que des connexions chiffrées, le hachage des mots de passe et des jetons de session, le chiffrement des secrets d'administration, des contrôles d'accès, des notifications de paiement signées et des journaux d'audit. Nous ne collectons jamais de numéros de carte, de clés privées ni de phrases de récupération.",
            "En cas de violation de données personnelles, nous l'analysons et en limitons les effets. Nous la notifions aux autorités et aux personnes concernées lorsque la loi l'exige et selon les modalités qu'elle prévoit.",
          ],
        },
        {
          id: "children",
          heading: "9. Enfants",
          blocks: [
            "Le service ne s'adresse pas aux enfants, et nous ne collectons pas sciemment de données les concernant. Si vous pensez qu'un enfant nous a transmis des données, contactez-nous et nous les supprimerons.",
          ],
        },
        {
          id: "changes",
          heading: "10. Modifications",
          blocks: [
            "Nous mettons à jour cette politique lorsque nos traitements évoluent, avec un nouveau numéro de version et une nouvelle date. Les changements importants sont signalés sur le site.",
          ],
        },
      ],
    }),

    cookies: (ctx) => ({
      title: "Politique relative aux cookies",
      description: "Les cookies et le stockage du navigateur utilisés par ESIMPROVE, et comment accepter, refuser ou retirer votre consentement.",
      intro:
        "Cette politique liste les cookies et les autres stockages du navigateur utilisés sur ESIMPROVE, et la manière de les contrôler. Nous utilisons uniquement ce qui est nécessaire au fonctionnement du site, ainsi qu'une mesure d'audience facultative si vous l'acceptez.",
      sections: [
        {
          id: "consent",
          heading: "1. Fonctionnement du consentement",
          blocks: [
            "Lors de votre première visite, un bandeau vous permet de **refuser** les stockages facultatifs, de les **accepter** ou de **choisir** par catégorie ; les trois options sont aussi faciles d'accès l'une que l'autre. La mesure d'audience facultative ne se charge pas avant votre accord, et la refuser n'affecte ni le panier, ni le paiement, ni votre compte. Vous pouvez modifier votre choix à tout moment via **Paramètres des cookies** en bas de page.",
            "Votre choix est enregistré dans votre navigateur avec la version de la politique. Nous en conservons aussi une trace pseudonyme côté serveur afin de le respecter. Un choix absent ou obsolète n'est jamais considéré comme un consentement. Le consentement à la mesure d'audience expire après 180 jours.",
          ],
        },
        {
          id: "necessary",
          heading: "2. Stockages strictement nécessaires",
          blocks: [
            "Ces éléments sont nécessaires aux fonctions que vous demandez (connexion, panier, langue, mémorisation de votre choix) et ne requièrent pas de consentement.",
            {
              table: {
                caption: "Cookies et stockages strictement nécessaires",
                head: ["Nom", "Type", "Finalité", "Durée"],
                rows: [
                  ["esimprove_session", "Cookie (HTTP-only)", "Maintient votre connexion de façon sécurisée", "Jusqu'à 30 jours (10 minutes pendant la connexion en deux étapes)"],
                  ["cart_token", "Cookie (HTTP-only)", "Conserve le contenu de votre panier", "30 jours"],
                  ["esimprove_guest_orders", "Cookie (HTTP-only)", "Permet à cet appareil de rouvrir les commandes passées en tant qu'invité, sans compte", "1 an, ou jusqu'à leur retrait dans Mes commandes"],
                  ["esimprove_oauth", "Cookie (HTTP-only)", "Protège une connexion Google ou Apple en cours", "10 minutes"],
                  ["esimprove_locale", "Cookie", "Mémorise la langue choisie", "1 an"],
                  ["es_consent_v1", "Stockage local", "Mémorise votre choix concernant les cookies et sa version", "Jusqu'à modification ou effacement des données du site"],
                  ["es_consent_id", "Stockage local", "Identifiant aléatoire reliant votre navigateur à la trace de votre consentement (conservé uniquement haché de notre côté)", "Jusqu'à effacement des données du site"],
                ],
              },
            },
          ],
        },
        {
          id: "analytics",
          heading: "3. Mesure d'audience facultative (avec consentement uniquement)",
          blocks: [
            {
              table: {
                caption: "Stockages de mesure d'audience facultatifs",
                head: ["Nom", "Type", "Finalité", "Durée"],
                rows: [
                  ["es_analytics_visitor", "Stockage local", "Identifiant de visiteur pseudonyme aléatoire pour notre propre mesure d'audience (conservé uniquement haché de notre côté)", "Jusqu'à effacement des données du site"],
                  ["es_analytics_session", "Stockage de session", "Regroupe les pages vues au cours d'une visite", "Jusqu'à la fermeture de l'onglet"],
                  ...(ctx.ga4Configured
                    ? [["_ga, _ga_*", "Cookies (Google)", "Mesure Google Analytics 4, fonctions publicitaires désactivées", "Jusqu'à 2 ans"]]
                    : []),
                ],
              },
            },
            ctx.ga4Configured
              ? "Google Analytics 4 ne se charge qu'après acceptation de la mesure d'audience."
              : "Google Analytics n'est pas utilisé actuellement sur ce site.",
            "Nous n'utilisons pas de cookies publicitaires, de reciblage ou de réseaux sociaux. Si cela devait changer, nous mettrions d'abord cette politique à jour et vous demanderions votre consentement.",
          ],
        },
        {
          id: "third-party",
          heading: "4. Pages de paiement",
          blocks: [
            "Lorsque le paiement par carte est disponible et que vous le choisissez, le formulaire de paiement est fourni par notre prestataire (Whop). Il peut utiliser ses propres cookies, nécessaires à la sécurité et à la lutte contre la fraude, selon ses propres politiques.",
          ],
        },
        {
          id: "control",
          heading: "5. Modifier votre choix",
          blocks: [
            "Utilisez **Paramètres des cookies** en bas de page pour modifier ou retirer votre consentement. Le retrait arrête la mesure d'audience pour l'avenir. Vous pouvez aussi supprimer les cookies et les données du site dans les réglages de votre navigateur ; vous devrez peut-être alors vous reconnecter et refaire votre choix. Nous respectons également les signaux Do Not Track et Global Privacy Control en ne collectant pas de mesure d'audience.",
          ],
        },
      ],
    }),

    notice: () => ({
      title: "Mentions légales, contact et réclamations",
      description: "Qui exploite ESIMPROVE, comment nous contacter et comment les réclamations sont traitées.",
      intro:
        "Cette page présente les informations sur le vendeur que nous pouvons publier actuellement, et explique comment nous contacter et formuler une réclamation.",
      sections: [
        {
          id: "seller",
          heading: "1. Vendeur",
          blocks: [
            "ESIMPROVE est une marque en ligne qui vend des forfaits de données eSIM prépayés pour les voyages. Elle est exploitée par une personne physique depuis le Viêt Nam. Ce n'est pas une société immatriculée, et elle n'a ni numéro d'immatriculation ni numéro de TVA. Les informations complètes sur le vendeur figurent dans l'encadré ci-dessous. Les informations pas encore publiées y sont signalées comme telles plutôt qu'inventées.",
          ],
        },
        {
          id: "contact",
          heading: "2. Contact",
          blocks: [
            "E-mail : {email}. Cette adresse unique traite l'assistance, les remboursements, les réclamations et les demandes relatives aux données. Nous ne proposons pas d'assistance téléphonique. Vous pouvez aussi utiliser la [page de contact](/contact) ou le [formulaire de demande relative aux données](/privacy/request).",
          ],
        },
        {
          id: "complaints",
          heading: "3. Traitement des réclamations",
          blocks: [
            {
              ol: [
                "Envoyez votre réclamation à {email} avec votre numéro de commande, ce qui s'est passé et ce que vous attendez de nous.",
                "Nous en accusons réception sous 3 jours ouvrés.",
                "Nous vous apportons une réponse complète sous 14 jours. S'il nous faut plus de temps, par exemple pour obtenir des informations de notre fournisseur, nous vous en expliquons la raison et vous indiquons quand attendre une réponse.",
                "Si vous n'êtes pas satisfait, vous pouvez demander un réexamen ou saisir l'autorité de protection des consommateurs ou un médiateur de la consommation de votre pays.",
              ],
            },
            "Une réclamation auprès de nous n'affecte pas vos droits, y compris celui de saisir la justice.",
          ],
        },
        {
          id: "content",
          heading: "4. Contenu du site",
          blocks: [
            "Nous veillons à l'exactitude des descriptions de forfaits, de la couverture et des prix. Ces informations proviennent de notre fournisseur, et les réseaux peuvent évoluer. Si vous constatez une erreur, signalez-la-nous. Les marques, comme les noms d'appareils et de réseaux, appartiennent à leurs propriétaires ; elles ne sont citées que pour décrire la compatibilité et la couverture.",
          ],
        },
      ],
    }),

    accessibility: () => ({
      title: "Déclaration d'accessibilité",
      description: "Comment ESIMPROVE veille à être utilisable par tous, limites connues et comment signaler un obstacle.",
      intro:
        "Nous voulons que chacun puisse acheter et utiliser une eSIM via ESIMPROVE, y compris les personnes qui utilisent des technologies d'assistance.",
      sections: [
        {
          id: "measures",
          heading: "1. Ce que nous faisons",
          blocks: [
            {
              ul: [
                "Nous utilisons une structure de page sémantique, des formulaires étiquetés et des indicateurs de focus visibles ; le site est utilisable au clavier.",
                "Les images porteuses de sens ont une alternative textuelle, et les couleurs sont choisies pour un contraste lisible.",
                "Le site prend en charge la lecture de droite à gauche en arabe et s'adapte aux écrans de téléphone.",
                "Les eSIM peuvent être installées manuellement aussi bien que par code QR.",
              ],
            },
            "Notre objectif est de respecter les règles WCAG 2.2, niveau AA. Le site n'a pas fait l'objet d'un audit d'accessibilité indépendant ; nous ne revendiquons donc pas une conformité totale.",
          ],
        },
        {
          id: "limits",
          heading: "2. Limites connues",
          blocks: [
            "Certains contenus proviennent de tiers, comme les descriptions de forfaits du fournisseur ou le formulaire de paiement par carte, et peuvent ne pas atteindre le même niveau. Les caractéristiques des forfaits fournies par notre fournisseur sont actuellement affichées en anglais.",
          ],
        },
        {
          id: "feedback",
          heading: "3. Signaler un obstacle",
          blocks: [
            "Si vous avez des difficultés à utiliser une partie du site, écrivez à {email} en indiquant la page et le problème. Nous répondons sous 5 jours ouvrés et vous aidons, si nécessaire, à finaliser votre achat autrement.",
          ],
        },
      ],
    }),
  },
};
