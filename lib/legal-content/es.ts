import type { LegalLanguagePack } from "./types";

/** Versión en español (2.0). Mismas secciones que la versión inglesa. */
export const es: LegalLanguagePack = {
  profile: () => ({
    heading: "Información del vendedor",
    rows: [
      ["Nombre comercial", "ESIMPROVE"],
      ["Quién lo gestiona", "ESIMPROVE es una marca en línea gestionada por una persona física. No es una sociedad registrada."],
      ["Nombre legal del titular", "Aún no publicado. Se añadirá aquí antes de activar los pagos con tarjeta."],
      ["País de operación", "Vietnam (ubicación operativa provisional)"],
      ["Dirección postal", "Aún no publicada. No hay oficina abierta al público; el servicio funciona en línea."],
      ["Número de empresa / IVA", "Ninguno. ESIMPROVE no tiene ni declara número de registro mercantil ni de IVA."],
      ["Correo electrónico (soporte, reclamaciones, privacidad)", "{email}"],
      ["Teléfono", "No hay línea telefónica. El soporte se presta por correo electrónico."],
    ],
    note: "Solo publicamos datos que podemos verificar. Los datos que faltan se indican como no publicados en lugar de inventarse.",
    translationNote:
      "Este documento está disponible en inglés, francés, español y árabe, con el mismo significado. Si hubiera diferencias, prevalece la versión inglesa, salvo que la ley de su país disponga otra cosa, y cualquier ambigüedad real se interpreta a su favor.",
  }),

  docs: {
    terms: () => ({
      title: "Términos y condiciones",
      description: "El contrato entre usted y ESIMPROVE: pedidos, entrega, pago, sus derechos, uso aceptable y responsabilidad.",
      intro:
        "Estos términos son el acuerdo entre usted y ESIMPROVE cuando usa este sitio web o compra un plan eSIM. Léalos junto con los documentos a los que remiten (servicio eSIM, pagos, reembolsos y privacidad). Nada de lo aquí dispuesto elimina los derechos que le reconocen las leyes imperativas de protección del consumidor o de protección de datos de su país de residencia.",
      sections: [
        {
          id: "who",
          heading: "1. Quiénes somos y cómo contactarnos",
          blocks: [
            "ESIMPROVE es una tienda en línea de planes de datos eSIM prepago para viajar. Es una marca en línea gestionada por una persona física desde Vietnam, y no una sociedad registrada. Los datos del vendedor que podemos publicar están en el [aviso legal](/legal/notice).",
            "Puede escribirnos a {email}. Respondemos por correo electrónico; no hay línea telefónica.",
          ],
        },
        {
          id: "documents",
          heading: "2. Documentos que forman nuestro acuerdo",
          blocks: [
            "Al hacer un pedido se aplican, en la versión mostrada al pagar, los siguientes documentos:",
            {
              ul: [
                "estos términos y condiciones;",
                "las [condiciones del servicio eSIM y de entrega](/legal/esim-service) (compatibilidad, cobertura, activación y validez);",
                "las [condiciones de pago](/legal/payments) (tarjeta y USDT);",
                "la [política de reembolso, cancelación y desistimiento](/legal/refunds).",
              ],
            },
            "La [política de privacidad](/legal/privacy) y la [política de cookies](/legal/cookies) explican cómo tratamos los datos personales. Son avisos informativos, no cláusulas contractuales que usted acepte.",
            "La versión aceptada se registra con su pedido. Los cambios posteriores solo se aplican a pedidos posteriores, salvo que la ley disponga otra cosa.",
          ],
        },
        {
          id: "eligibility",
          heading: "3. Quién puede comprar",
          blocks: [
            "Debe tener capacidad legal para contratar en su país, lo que normalmente supone ser mayor de edad. El servicio no está dirigido a menores.",
            "No debe comprar ni usar el servicio si la ley o sanciones internacionales que le afecten a usted o a nosotros lo prohíben.",
          ],
        },
        {
          id: "service",
          heading: "4. Qué vendemos",
          blocks: [
            "Vendemos planes de datos eSIM prepago para viajar. Un plan ofrece un volumen de datos durante un periodo indicado, en los países listados en la página del plan. Salvo que la página del plan diga otra cosa, los planes son **solo de datos**: no incluyen número de teléfono, llamadas ni SMS, y **no permiten llamar a los servicios de emergencia**.",
            "Los datos móviles los suministra un mayorista de eSIM y los transportan redes móviles locales. ESIMPROVE es el vendedor con quien usted contrata. No somos un operador de red móvil. Las [condiciones del servicio eSIM](/legal/esim-service) explican lo que esto implica para la cobertura, la velocidad y la disponibilidad.",
            "Antes de comprar, compruebe que su dispositivo admite eSIM y no está bloqueado por un operador, con la [guía de compatibilidad](/compatibility) y los detalles del plan.",
          ],
        },
        {
          id: "prices",
          heading: "5. Precios",
          blocks: [
            "Los precios se muestran en dólares estadounidenses (USD). El total que aparece al pagar es el total que usted paga a ESIMPROVE. No añadimos cargos después del pedido ni recargos por el método de pago elegido.",
            "En los pagos con USDT, el total se convierte a razón de 1 USDT = 1 USD. Para identificar su transferencia se añade un importe único de como máximo 0,0099 USDT (menos de un centavo de dólar). Consulte las [condiciones de pago](/legal/payments).",
            "Su banco, el emisor de su tarjeta, su monedero o su plataforma de intercambio pueden cobrar sus propias comisiones, por ejemplo de cambio de divisa o de red blockchain (gas). Esas comisiones son una cuestión entre usted y ese proveedor.",
            "Si se produce un error de precio evidente, se lo comunicaremos antes de entregar la eSIM. Podrá confirmar el pedido al precio correcto o cancelarlo con reembolso íntegro.",
          ],
        },
        {
          id: "order",
          heading: "6. Cómo un pedido se convierte en contrato",
          blocks: [
            {
              ol: [
                "Elige un plan, revisa el resumen y el total del pedido y acepta estos términos.",
                "Solicita el suministro inmediato de la eSIM y reconoce cómo afecta a su derecho de desistimiento (véase la sección 9).",
                "Pulsa **Comprar ahora**. Es un pedido con obligación de pago.",
                "El contrato se celebra cuando se confirma su pago: con tarjeta, cuando el proveedor de pagos lo aprueba; con USDT, cuando la transferencia se verifica en BNB Smart Chain.",
              ],
            },
            "Podemos rechazar un pedido antes de que se confirme el pago, por ejemplo si un plan no está disponible temporalmente o si el pedido parece fraudulento. Si rechazamos un pedido después de que usted haya pagado, le reembolsamos íntegramente.",
            "El pago se desactiva para un plan cuando nuestro proveedor no puede suministrarlo en ese momento. Así nunca cobramos por una eSIM que no podemos entregar.",
          ],
        },
        {
          id: "delivery",
          heading: "7. Entrega",
          blocks: [
            "En cuanto se confirma el pago, pedimos su eSIM a nuestro proveedor de forma automática. Los datos de la eSIM suelen estar disponibles en pocos minutos, con el código QR y los datos de instalación manual. Aparecen en la página de su pedido (mediante el enlace seguro mostrado tras el pago) y en su cuenta, si tiene una.",
            "Si el proveedor no puede emitir la eSIM, su pago queda protegido y una persona revisa el pedido. Después le entregamos la eSIM o le reembolsamos íntegramente. Nunca marcamos un pedido como entregado si el proveedor no ha emitido realmente la eSIM.",
          ],
        },
        {
          id: "your-responsibilities",
          heading: "8. Sus responsabilidades",
          blocks: [
            {
              ul: [
                "Facilite un correo electrónico correcto y proteja el enlace de su pedido y su cuenta: cualquiera con el enlace o el código QR puede intentar instalar la eSIM.",
                "Compruebe la compatibilidad del dispositivo y los detalles del plan (países, datos, validez y fecha límite de activación) antes de comprar.",
                "Siga las instrucciones de instalación y no elimine la eSIM hasta que termine el plan. Muchas eSIM solo pueden instalarse una vez.",
                "Cumpla las leyes de los países a los que viaja y las [normas de uso aceptable](#acceptable-use).",
              ],
            },
          ],
        },
        {
          id: "withdrawal",
          heading: "9. Su derecho de desistimiento",
          blocks: [
            "En la Unión Europea, el Reino Unido y algunos otros países, los consumidores suelen tener 14 días para desistir de una compra en línea. Para contenidos y servicios digitales, la ley permite iniciar el suministro de inmediato si usted lo solicita y reconoce que perderá ese derecho una vez suministrado el contenido o el servicio.",
            "Al pagar, le pedimos que confirme que desea recibir la eSIM de inmediato. También reconoce que pierde el derecho a desistir por simple cambio de opinión una vez que la eSIM se ha **instalado o activado**. Hasta entonces puede cancelar con reembolso íntegro (véase la [política de reembolso](/legal/refunds)).",
            "Si la ley de su país considera un plan eSIM como un servicio del que puede desistir en 14 días incluso después de iniciado, respetaremos ese derecho. En ese caso solo pagará la parte del plan ya utilizada, como explica la política de reembolso.",
          ],
        },
        {
          id: "faults",
          heading: "10. Si algo sale mal",
          blocks: [
            "Si su eSIM no funciona según lo descrito por un fallo nuestro o de nuestro proveedor, contáctenos. Le ayudaremos a resolverlo y, después, le daremos una eSIM de sustitución que funcione o un reembolso total o parcial, según lo que se haya suministrado. Esto no limita ningún remedio que su ley local le conceda por productos o servicios digitales defectuosos o no conformes.",
          ],
        },
        {
          id: "acceptable-use",
          heading: "11. Uso aceptable",
          blocks: [
            "No debe usar el sitio ni una eSIM:",
            {
              ul: [
                "para nada ilegal, incluidos el fraude, el blanqueo de capitales o la elusión de sanciones;",
                "para enviar spam, atacar redes o sistemas o perjudicar a otros usuarios;",
                "para revender o redistribuir eSIM comercialmente sin nuestro acuerdo por escrito;",
                "superando los límites de uso razonable indicados en la página del plan o aplicados por la red (por ejemplo servidores, tráfico automatizado o «SIM box»);",
                "con medios de pago robados, el monedero de otra persona sin permiso o datos falsos;",
                "para sondear, extraer datos masivamente o sobrecargar el sitio, o para eludir su seguridad.",
              ],
            },
            "Las redes pueden ralentizar, restringir o cortar un uso que incumpla sus normas. Podemos rechazar o cancelar pedidos vinculados a fraude o abuso.",
          ],
        },
        {
          id: "suspension",
          heading: "12. Suspensión y cierre de cuenta",
          blocks: [
            "Podemos suspender una cuenta o denegar el servicio en caso de incumplimiento grave de estos términos, sospecha de fraude u obligación legal. Cuando sea posible, le explicaremos el motivo y le daremos la oportunidad de responder. Si interrumpimos un servicio pagado sin culpa por su parte, le reembolsamos la parte no utilizada.",
            "Puede cerrar su cuenta en cualquier momento contactándonos o mediante el [formulario de solicitud de privacidad](/privacy/request).",
          ],
        },
        {
          id: "liability",
          heading: "13. Nuestra responsabilidad",
          blocks: [
            "Respondemos de suministrar el plan eSIM tal como se describe, con un cuidado y una diligencia razonables.",
            "Nada de lo dispuesto en estos términos limita nuestra responsabilidad por muerte o lesiones causadas por nuestra negligencia, por fraude o por cualquier otro supuesto en que la ley no permita limitarla.",
            "La cobertura móvil depende de las redes locales. No respondemos de pérdidas que no pudiéramos prever razonablemente al hacerse el pedido, de pérdidas empresariales (un plan de consumo es para uso personal) ni de interrupciones causadas por hechos ajenos a nuestro control razonable (sección 14). Sin perjuicio del párrafo anterior, si somos responsables de una pérdida, nuestra responsabilidad se limita al precio pagado por el pedido afectado. Este límite no reduce ningún remedio legal que le corresponda como consumidor.",
          ],
        },
        {
          id: "force-majeure",
          heading: "14. Hechos ajenos a nuestro control",
          blocks: [
            "No respondemos de retrasos o fallos causados por hechos que no pudimos evitar razonablemente, como caídas de red, restricciones públicas de los servicios móviles, catástrofes naturales, guerras o fallos de la red blockchain. Si un hecho así nos impide entregar un plan pagado, le reembolsamos.",
          ],
        },
        {
          id: "complaints",
          heading: "15. Reclamaciones y litigios",
          blocks: [
            "Contáctenos primero en {email}: la mayoría de los problemas se resuelven rápidamente. Nuestro procedimiento de reclamaciones y los plazos de respuesta están en el [aviso legal](/legal/notice#complaints).",
            "También puede acudir a la autoridad de consumo o a un organismo de resolución alternativa de litigios de su país. La plataforma europea de resolución de litigios en línea cerró el 20 de julio de 2025, por lo que no enlazamos a ella.",
          ],
        },
        {
          id: "law",
          heading: "16. Ley aplicable y tribunales",
          blocks: [
            "Estos términos se rigen por la ley de Vietnam, donde se gestiona ESIMPROVE. Si es usted consumidor, conserva la protección de las normas imperativas de su país de residencia y puede demandar ante los tribunales de ese país cuando la ley lo permita.",
          ],
        },
        {
          id: "changes",
          heading: "17. Cambios en estos términos",
          blocks: [
            "Podemos actualizar estos términos, por ejemplo por cambios legales o en nuestro servicio. La nueva versión llevará un nuevo número y una nueva fecha. Solo se aplica a los pedidos realizados después de su publicación. No cambiaremos las condiciones de un pedido ya realizado sin su consentimiento.",
          ],
        },
      ],
    }),

    esim: () => ({
      title: "Condiciones del servicio eSIM y de entrega",
      description: "Compatibilidad, cobertura, activación, validez, entrega y qué ocurre si una eSIM no puede entregarse.",
      intro:
        "Esta página explica cómo funcionan los planes eSIM de ESIMPROVE y sus límites, para que pueda decidir si un plan es adecuado para su viaje. Forma parte de nuestros [términos y condiciones](/legal/terms).",
      sections: [
        {
          id: "what",
          heading: "1. Qué es un plan eSIM",
          blocks: [
            "Una eSIM es una SIM digital que se instala en un teléfono, tableta u otro dispositivo compatible escaneando un código QR o introduciendo datos manualmente. Nuestros planes son planes de datos móviles prepago para viajar. Cada página de plan muestra los países cubiertos, el volumen de datos, la validez, las redes, la regla de activación y la fecha límite de activación.",
            "Salvo que la página del plan diga otra cosa, los planes son **solo de datos**: no hay número de teléfono, llamadas ni SMS, y **no se puede llamar a los números de emergencia**. Tenga siempre otra forma de contactar con los servicios de emergencia.",
          ],
        },
        {
          id: "compatibility",
          heading: "2. Compatibilidad y desbloqueo del dispositivo",
          blocks: [
            "Su dispositivo debe:",
            {
              ul: [
                "admitir eSIM (algunos modelos vendidos en ciertas regiones no la admiten, aunque el mismo modelo sí lo haga en otras);",
                "estar **libre**, es decir, no bloqueado a un operador;",
                "admitir las bandas de red móvil utilizadas en su destino.",
              ],
            },
            "Consulte la [guía de compatibilidad](/compatibility) y los ajustes de su dispositivo antes de comprar. Nuestra información de compatibilidad es orientativa; el fabricante y su operador tienen la última palabra. Si descubre que su dispositivo no es compatible **antes** de instalar la eSIM, le reembolsamos íntegramente.",
          ],
        },
        {
          id: "coverage",
          heading: "3. Cobertura, redes y velocidad",
          blocks: [
            {
              ul: [
                "Los planes usan redes asociadas en cada país. Qué redes se usan y si hay 4G/5G dependen de la red local y del lugar. La cobertura puede ser menor en interiores, bajo tierra, en el mar, en vuelo y en zonas remotas.",
                "La velocidad no está garantizada. Depende de la red, la congestión, su dispositivo y las normas de uso razonable del plan. Algunos planes reducen la velocidad tras un volumen diario (la página del plan lo indica).",
                "Su tráfico de internet puede salir por otro país. Los sitios web pueden entonces ver un país distinto de aquel en el que se encuentra.",
                "Algunos países restringen ciertas aplicaciones o servicios (por ejemplo, las llamadas por internet). No controlamos esas restricciones locales.",
              ],
            },
          ],
        },
        {
          id: "validity",
          heading: "4. Activación, validez y datos",
          blocks: [
            {
              ul: [
                "**Inicio de la validez.** La página del plan indica si la validez empieza al instalar la eSIM o cuando se conecta por primera vez a una red compatible en un país cubierto.",
                "**Fecha límite de activación.** La mayoría de los planes deben activarse en un plazo tras la compra (a menudo 180 días), indicado en la página del plan. Pasado ese plazo, un plan sin usar caduca.",
                "**Datos.** Los planes de volumen total terminan cuando se agotan los datos o la validez, lo que ocurra primero. Los planes diarios dan un volumen por día; superado este, la velocidad se reduce o el servicio se pausa hasta el día siguiente, según indique la página del plan. Los datos no usados no se acumulan ni se reembolsan proporcionalmente.",
                "**Recargas.** Por ahora ESIMPROVE no vende recargas. Si necesita más datos, compre un nuevo plan.",
              ],
            },
          ],
        },
        {
          id: "install",
          heading: "5. Instalar su eSIM",
          blocks: [
            {
              ol: [
                "Instale la eSIM antes de viajar, conectado a una red wifi: escanee el código QR de la página de su pedido o introduzca manualmente la dirección SM-DP+ y el código de activación.",
                "No elimine la eSIM tras instalarla: muchas eSIM solo pueden instalarse una vez, y una eSIM eliminada puede no recuperarse.",
                "Al llegar, seleccione la eSIM para los datos móviles y active la **itinerancia de datos** en esa línea.",
                "Mantenga en privado su código QR: quien lo tenga puede instalar la eSIM antes que usted.",
              ],
            },
          ],
        },
        {
          id: "delivery",
          heading: "6. Plazos de entrega",
          blocks: [
            "Pedimos su eSIM al proveedor en cuanto se confirma el pago. Los datos de la eSIM suelen aparecer en la página de su pedido en pocos minutos. Los pagos con tarjeta se confirman cuando el proveedor de pagos los aprueba. Los pagos con USDT se confirman tras 15 confirmaciones en BNB Smart Chain, lo que suele tardar menos de un minuto desde su transferencia.",
            "Por ahora no enviamos la eSIM por correo electrónico. Guarde el enlace seguro mostrado tras el pago, o cree una cuenta y encuentre sus eSIM en **Mis eSIM**.",
          ],
        },
        {
          id: "failure",
          heading: "7. Si una eSIM no puede entregarse o activarse",
          blocks: [
            {
              ul: [
                "Si nuestro proveedor no puede emitir su eSIM (por ejemplo, por falta de existencias), su pedido queda en espera para que lo revise una persona, y su pago queda protegido. Después le entregamos la eSIM o le reembolsamos íntegramente. Nunca marcamos un pedido como entregado sin datos reales de eSIM del proveedor.",
                "Si la eSIM se emite pero no se conecta, contáctenos con su número de pedido. Comprobaremos su estado con el proveedor, le ayudaremos a resolverlo y la sustituiremos o reembolsaremos si el problema es nuestro o del proveedor.",
                "Si la activación falla porque el dispositivo no es compatible o está bloqueado, o porque se eliminó la eSIM, puede no ser posible un reembolso una vez instalada. Véase la [política de reembolso](/legal/refunds).",
              ],
            },
          ],
        },
        {
          id: "supplier",
          heading: "8. Dependencia del proveedor y de las redes",
          blocks: [
            "Los perfiles eSIM los emite nuestro mayorista, y el servicio lo prestan redes locales. Su mantenimiento, sus caídas o sus cambios pueden interrumpir el servicio. Si una interrupción impide usar como se describe un plan pagado, ofreceremos una sustitución o el reembolso de la parte afectada.",
          ],
        },
      ],
    }),

    payments: () => ({
      title: "Condiciones de pago",
      description: "Cómo funcionan los pagos con tarjeta y con USDT (BEP-20), cuándo un pedido se considera pagado y qué ocurre con pagos erróneos, tardíos o parciales.",
      intro:
        "Esta página explica los métodos de pago que acepta ESIMPROVE, cuándo se considera pagado su pedido y cómo se gestionan los problemas de pago. Forma parte de nuestros [términos y condiciones](/legal/terms).",
      sections: [
        {
          id: "methods",
          heading: "1. Métodos de pago",
          blocks: [
            {
              ul: [
                "**Tarjeta.** Los pagos con tarjeta (y Apple Pay o Google Pay si su dispositivo los admite) los procesa nuestro proveedor de pagos, Whop, en su formulario seguro mostrado dentro de nuestra página de pago. El formulario de Whop solicita los datos necesarios para procesar y proteger el pago, como su correo electrónico, los datos de la tarjeta y el nombre, país y dirección de facturación. Estos datos van directamente a Whop según su propia política de privacidad; ESIMPROVE nunca ve ni guarda el número de su tarjeta.",
                "**USDT (BEP-20) en BNB Smart Chain.** La única criptomoneda que aceptamos es Tether USD (USDT) como token BEP-20 en BNB Smart Chain (chain ID 56). La dirección del contrato del token es 0x55d398326f99059fF775485246999027B3197955.",
              ],
            },
            "No cobramos ningún recargo por el método de pago.",
          ],
        },
        {
          id: "usdt-amount",
          heading: "2. Cómo se fija el importe en USDT",
          blocks: [
            "Los precios están en dólares estadounidenses. Para USDT aplicamos un tipo fijo de **1 USDT = 1 USD**, sin tipo de mercado ni diferencial.",
            "Para asociar automáticamente su transferencia a su pedido, añadimos al total un importe único de **como máximo 0,0099 USDT** (menos de un centavo de dólar). El importe exacto que debe enviar aparece en la página de pago antes de enviar nada.",
            "Usted paga la comisión de red (gas) de BNB Smart Chain, que su monedero le muestra antes de confirmar. El importe que llegue a nuestra dirección debe ser exactamente el mostrado. Si envía desde una plataforma de intercambio, asegúrese de que su comisión de retirada no se descuente de ese importe.",
          ],
        },
        {
          id: "usdt-how",
          heading: "3. Cómo pagar con USDT",
          blocks: [
            {
              ol: [
                "Tras pulsar **Comprar ahora**, la página de pago muestra la dirección de recepción, la red (BNB Smart Chain, BEP-20) y el importe exacto en USDT.",
                "Envíe exactamente ese importe, en una sola transferencia, en BNB Smart Chain, en un plazo de **30 minutos**.",
                "Detectamos la transferencia automáticamente. También puede pegar el hash de la transacción en la página de pago.",
                "El pedido se marca como **pagado** cuando la transferencia tiene **15 confirmaciones de bloque** y se ha verificado de forma independiente: token, red, dirección e importe correctos.",
              ],
            },
            {
              callout:
                "Las transferencias en blockchain son irreversibles. Compruebe la red (BNB Smart Chain / BEP-20), el token (USDT) y la dirección antes de enviar. Nunca le pediremos que envíe a otra dirección o red, ni le pediremos su clave privada o frase de recuperación.",
            },
          ],
        },
        {
          id: "paid",
          heading: "4. Cuándo se considera pagado un pedido",
          blocks: [
            {
              ul: [
                "**Tarjeta:** cuando el proveedor de pagos nos confirma un pago correcto.",
                "**USDT:** cuando una transferencia del importe exacto a nuestra dirección alcanza 15 confirmaciones en BNB Smart Chain dentro del plazo de pago.",
              ],
            },
            "Que su monedero muestre una transacción como «enviada» no significa por sí solo que el pedido esté pagado. La página del pedido muestra el estado actual.",
          ],
        },
        {
          id: "problems",
          heading: "5. Pagos en USDT erróneos, tardíos, parciales o duplicados",
          blocks: [
            {
              table: {
                caption: "Qué ocurre en cada caso",
                head: ["Situación", "Qué hacemos"],
                rows: [
                  ["**Pago insuficiente** (menos que el importe exacto)", "El pedido no se paga automáticamente. Su transferencia queda registrada y la revisa una persona. Contáctenos: puede enviar el resto o pedir el reembolso de lo enviado."],
                  ["**Pago en exceso** (más que el importe exacto)", "Una persona revisa el pedido. Entregamos el pedido y le reembolsamos el exceso, o todo si lo prefiere."],
                  ["**Pago tardío** (después de los 30 minutos)", "Seguimos detectando transferencias tardías durante 24 horas. Una transferencia tardía nunca se pierde: se registra y se revisa, y entregamos el pedido o le reembolsamos."],
                  ["**Pago duplicado**", "Le reembolsamos íntegramente el pago de más."],
                  ["**Red o token equivocados** (por ejemplo, USDT en otra cadena u otra moneda)", "Estas transferencias no se detectan. Contáctenos con el hash de la transacción. Si los fondos llegaron a una dirección que controlamos y podemos recuperarlos con seguridad, se los devolvemos. Los fondos enviados a una dirección que no controlamos, o en una red a la que no tenemos acceso, pueden perderse definitivamente: no podemos revertir transferencias en blockchain."],
                  ["**Dirección equivocada**", "Los fondos enviados a una dirección distinta de la de su página de pago no nos llegan y no podemos recuperarlos."],
                ],
              },
            },
          ],
        },
        {
          id: "crypto-refunds",
          heading: "6. Cómo funcionan los reembolsos en USDT",
          blocks: [
            {
              ul: [
                "Los reembolsos se pagan en USDT (BEP-20) en BNB Smart Chain. Se calculan en dólares al mismo tipo de 1 USDT = 1 USD, de modo que el valor devuelto no depende de los movimientos del mercado.",
                "Reembolsamos al monedero desde el que se pagó, salvo que nos indique otra dirección de BNB Smart Chain que usted controle. Los reembolsos a direcciones de depósito de plataformas de intercambio pueden fallar; avísenos si pagó desde una plataforma.",
                "Pagamos nosotros la comisión de red de los reembolsos que enviamos.",
                "Como las transferencias en blockchain son irreversibles, podemos pedirle que confirme la dirección de reembolso desde el correo usado para el pedido.",
              ],
            },
          ],
        },
        {
          id: "crypto-notes",
          heading: "7. Información importante sobre criptomonedas",
          blocks: [
            {
              ul: [
                "USDT es una moneda estable emitida por una empresa privada. No es de curso legal y su valor puede diferir de un dólar estadounidense.",
                "Aceptamos USDT solo como forma de pagar planes eSIM. No intercambiamos, custodiamos ni invertimos criptomonedas por cuenta de clientes, y nada en este sitio es asesoramiento financiero.",
                "Las transacciones en blockchain son públicas. Su dirección de envío y la transacción quedan visibles en la blockchain de forma permanente (véase la [política de privacidad](/legal/privacy)).",
                "Usted es responsable de cumplir las normas fiscales y sobre criptomonedas de su país.",
              ],
            },
          ],
        },
        {
          id: "disputes",
          heading: "8. Contracargos y disputas de pago",
          blocks: [
            "Si hay un problema con un pago con tarjeta, contáctenos primero; normalmente lo resolvemos antes que un contracargo. Conserva cualquier derecho que tenga a impugnar un pago con tarjeta ante su banco. Si se abre una disputa, podemos compartir con el proveedor de pagos los registros del pedido, la entrega y el soporte para responder.",
            "Los pagos con criptomonedas no admiten contracargos. Los problemas de pago con USDT se gestionan directamente con nosotros, como se describe arriba.",
          ],
        },
      ],
    }),

    refunds: () => ({
      title: "Política de reembolso, cancelación y desistimiento",
      description: "Cuándo puede cancelar y recuperar su dinero, cómo se calculan los reembolsos parciales y cómo se pagan.",
      intro:
        "Esta política explica cuándo puede cancelar un pedido de eSIM y recuperar su dinero, y cómo tramitamos los reembolsos. Forma parte de nuestros [términos y condiciones](/legal/terms). Si la ley de su país le otorga más derechos, se aplican esos derechos.",
      sections: [
        {
          id: "summary",
          heading: "1. Resumen",
          blocks: [
            {
              table: {
                caption: "Cuándo recibe un reembolso",
                head: ["Situación", "Reembolso"],
                rows: [
                  ["eSIM aún no instalada ni activada (por cualquier motivo, incluido un cambio de opinión) y sin superar la fecha límite de activación", "Reembolso íntegro"],
                  ["No pudimos entregar la eSIM, o la entregamos tarde y ya no la quiere", "Reembolso íntegro"],
                  ["La eSIM no funciona por un fallo nuestro o del proveedor y no podemos repararla ni sustituirla", "Reembolso total o parcial (sección 4)"],
                  ["Plan sustancialmente distinto de su descripción (país, datos o validez erróneos)", "Sustitución, o reembolso total o parcial"],
                  ["Cobro duplicado, o pago superior al importe exacto", "Reembolso del importe de más"],
                  ["Cambio de opinión después de instalar o activar la eSIM", "Normalmente no reembolsable (pero véase la sección 3)"],
                  ["Dispositivo incompatible o bloqueado, descubierto solo tras la instalación", "Normalmente no reembolsable"],
                ],
              },
            },
          ],
        },
        {
          id: "before",
          heading: "2. Cancelar antes de la instalación o activación",
          blocks: [
            "Puede cancelar por cualquier motivo y recibir un reembolso íntegro siempre que la eSIM **no se haya instalado ni activado** y no haya pasado su fecha límite de activación. Comprobamos el estado de la eSIM con nuestro proveedor antes de reembolsar. Una vez aprobado el reembolso, cancelamos la eSIM y ya no podrá usarse.",
            "Esto es más favorable que el derecho mínimo de desistimiento de 14 días aplicable en la UE y el Reino Unido, porque no se limita a 14 días.",
          ],
        },
        {
          id: "withdrawal",
          heading: "3. El derecho legal de desistimiento de 14 días",
          blocks: [
            "Al pagar, nos pide que entreguemos la eSIM de inmediato. También reconoce que pierde el derecho a desistir por cambio de opinión una vez que la eSIM se instala o se activa. Así es como la ley permite suministrar al instante un producto digital.",
            "Si la ley de su país le permite desistir en 14 días incluso después de iniciado un plan eSIM (por considerarlo un servicio), puede hacerlo. En ese caso solo paga lo ya suministrado. Lo calculamos como la mayor de dos proporciones, la de los datos usados y la del periodo de validez transcurrido, y reembolsamos el resto.",
            "Para desistir, envíenos una declaración clara por correo electrónico ({email}) o mediante el formulario de contacto, con su número de pedido. No tiene que dar ningún motivo.",
          ],
        },
        {
          id: "faults",
          heading: "4. eSIM defectuosa o no conforme",
          blocks: [
            "Si una eSIM no funciona según lo descrito por un fallo nuestro o de nuestro proveedor, primero intentaremos solucionarlo o sustituirla. Si no es posible en un plazo razonable:",
            {
              ul: [
                "si no pudo usar el plan en absoluto, le reembolsamos íntegramente;",
                "si pudo usar una parte, le reembolsamos la parte no utilizada, calculada como en la sección 3.",
              ],
            },
            "No son fallos de la eSIM los problemas causados por una cobertura local acorde con lo descrito en la página del plan, por un dispositivo incompatible o bloqueado, o por haber eliminado la eSIM. Aun así, le ayudaremos en lo posible.",
          ],
        },
        {
          id: "how",
          heading: "5. Cómo pedir un reembolso",
          blocks: [
            "Escriba a {email} o use la [página de contacto](/contact), indicando:",
            {
              ul: [
                "su número de pedido y el correo usado para el pedido;",
                "qué ocurrió y cuándo, con mensajes de error o capturas de pantalla;",
                "si la eSIM se instaló o se usó;",
                "para reembolsos en USDT: la dirección del monedero a la que reembolsar, si es distinta de la que usó para pagar.",
              ],
            },
            "Nunca nos envíe su contraseña, códigos de un solo uso, número de tarjeta, clave privada ni frase de recuperación.",
          ],
        },
        {
          id: "processing",
          heading: "6. Cómo y cuándo se pagan los reembolsos",
          blocks: [
            {
              ul: [
                "Respondemos a las solicitudes de reembolso en un plazo de 5 días hábiles y pagamos los reembolsos aprobados en un plazo de 14 días.",
                "Los pagos con tarjeta se reembolsan en la misma tarjeta a través del proveedor de pagos. Su banco puede tardar unos días más en reflejarlo.",
                "Los pagos con USDT se reembolsan en USDT (BEP-20) como se describe en las [condiciones de pago](/legal/payments#crypto-refunds). Pagamos nosotros la comisión de red del reembolso.",
                "Si rechazamos una solicitud, le explicamos por qué y cómo reclamar. Un rechazo nunca elimina un derecho que le reconozca la ley imperativa.",
              ],
            },
          ],
        },
      ],
    }),

    privacy: (ctx) => ({
      title: "Política de privacidad",
      description: "Qué datos personales recoge ESIMPROVE, por qué, quién los recibe, cuánto tiempo se conservan y cuáles son sus derechos.",
      intro:
        "Esta política explica cómo trata ESIMPROVE sus datos personales cuando usa el sitio, compra una eSIM, paga o nos contacta. Recogemos solo lo necesario para vender y entregar eSIM y mantener el servicio seguro.",
      sections: [
        {
          id: "controller",
          heading: "1. Responsable del tratamiento",
          blocks: [
            "El responsable del tratamiento es el titular individual de ESIMPROVE, una marca en línea gestionada desde Vietnam (véase el [aviso legal](/legal/notice)). Para cualquier consulta o solicitud sobre privacidad, escriba a {email} o use el [formulario de solicitud](/privacy/request).",
            "ESIMPROVE no ha designado un representante en la Unión Europea ni en el Reino Unido. Puede contactarnos directamente por correo electrónico desde cualquier lugar.",
          ],
        },
        {
          id: "data",
          heading: "2. Qué datos recogemos",
          blocks: [
            {
              table: {
                caption: "Datos personales que tratamos",
                head: ["Categoría", "Ejemplos", "Origen"],
                rows: [
                  ["Pedido", "correo, nombre, país de residencia, plan, cantidad, precios, estado del pedido, versión de los términos aceptada, su solicitud de suministro inmediato", "Usted, al pagar"],
                  ["eSIM", "ICCID, código de activación / código QR, estado de la eSIM, fecha de caducidad", "Nuestro proveedor de eSIM"],
                  ["Pago con tarjeta", "importe, estado y referencia del proveedor. **Nunca recibimos su número de tarjeta.**", "Proveedor de pagos"],
                  ["Pago con USDT", "dirección del monedero desde el que pagó, hash de la transacción, importe y confirmaciones", "BNB Smart Chain (pública)"],
                  ["Cuenta", "nombre, correo, contraseña (guardada solo como hash seguro), sesiones", "Usted"],
                  ["Soporte y solicitudes de privacidad", "sus mensajes y nuestras respuestas, estado de la solicitud", "Usted"],
                  ["Registros de consentimiento", "sus elecciones sobre cookies y marketing y la versión de los términos aceptada, con fecha y hora", "Usted"],
                  ["Seguridad", "tokens de sesión cifrados mediante hash, huella de su dirección de red calculada con clave para limitar abusos, registros de auditoría", "Su dispositivo / nuestros sistemas"],
                  ["Analítica (solo con consentimiento)", "identificadores seudónimos de visitante y de sesión (guardados con hash), páginas vistas, tipo de dispositivo y navegador, país aproximado", "Su dispositivo"],
                ],
              },
            },
            "No pedimos documentos de identidad, fecha de nacimiento, ubicación precisa ni contactos.",
          ],
        },
        {
          id: "purposes",
          heading: "3. Finalidades y base jurídica",
          blocks: [
            {
              table: {
                caption: "Finalidades y bases jurídicas",
                head: ["Finalidad", "Base jurídica (cuando se aplica la normativa de protección de datos de la UE o el Reino Unido)"],
                rows: [
                  ["Tramitar y entregar su pedido, suministrar su eSIM, dar soporte y reembolsos", "Ejecución de un contrato"],
                  ["Verificar pagos y prevenir el fraude y los abusos", "Interés legítimo (proteger a los clientes y el negocio); contrato"],
                  ["Conservar registros de pedidos, pagos y reembolsos", "Obligación legal (fiscal y contable); interés legítimo (gestión de reclamaciones)"],
                  ["Gestionar su cuenta y su seguridad", "Contrato; interés legítimo (seguridad)"],
                  ["Analítica opcional", "Consentimiento, que puede retirar en cualquier momento"],
                  ["Correos de marketing opcionales", "Consentimiento; puede darse de baja en cualquier momento"],
                  ["Atender solicitudes de privacidad y reclamaciones legales", "Obligación legal; interés legítimo"],
                ],
              },
            },
            "Cuando la ley de su país exige su consentimiento para un uso concreto, se lo pedimos, y puede retirarlo en cualquier momento. Retirarlo no afecta al tratamiento realizado antes.",
          ],
        },
        {
          id: "recipients",
          heading: "4. Quién recibe sus datos",
          blocks: [
            "Solo compartimos datos con proveedores que nos ayudan a prestar el servicio, y solo lo que cada uno necesita:",
            {
              table: {
                caption: "Proveedores de servicios",
                head: ["Proveedor", "Función", "Datos"],
                rows: [
                  ["Netlify (Estados Unidos)", "Alojamiento web", "Datos técnicos necesarios para mostrar el sitio"],
                  ["Neon (base de datos alojada en Amazon Web Services, Estados Unidos)", "Base de datos", "Los datos descritos en la sección 2"],
                  ["eSIM Access (nuestro mayorista de eSIM)", "Emite los perfiles eSIM", "El plan pedido y una referencia de transacción anónima. **No enviamos su nombre ni su correo al proveedor.**"],
                  ["NodeReal (proveedor de datos blockchain)", "Lee BNB Smart Chain para verificar pagos en USDT", "Consultas sobre nuestra dirección de recepción y hashes de transacción (datos públicos de la blockchain)"],
                  ["Whop (proveedor de pagos con tarjeta)", "Procesa pagos con tarjeta, Apple Pay y Google Pay", "Los datos que introduzca en su formulario de pago (correo, tarjeta y facturación), junto con la referencia y el importe del pedido. También se aplica la política de privacidad de Whop."],
                  ["Google y Apple (inicio de sesión opcional)", "Inician su sesión si elige Continuar con Google o Apple", "Su ID de cuenta en ese proveedor, su correo verificado y su nombre"],
                  ["Resend (envío de correos, cuando esté activado)", "Envía correos opcionales del pedido y la eSIM", "Su correo electrónico y el contenido del mensaje"],
                  ...(ctx.ga4Configured
                    ? [["Google (Google Analytics 4)", "Analítica opcional, solo con consentimiento", "Cookies de analítica y datos de uso"]]
                    : []),
                ],
              },
            },
            "No vendemos sus datos personales ni los usamos para perfiles publicitarios. Podemos comunicar datos si la ley lo exige, para formular o defender reclamaciones o para prevenir el fraude.",
            "**Blockchain pública.** Si paga con USDT, su transacción (incluidos su dirección de envío y el importe) queda registrada de forma permanente en BNB Smart Chain, que es pública. Nadie, ni siquiera nosotros, puede borrarla.",
          ],
        },
        {
          id: "transfers",
          heading: "5. Transferencias internacionales",
          blocks: [
            "ESIMPROVE se gestiona desde Vietnam y nuestros principales proveedores almacenan datos en Estados Unidos, por lo que sus datos se transfieren fuera de su país. Cuando la ley exige garantías para estas transferencias, nos basamos en las condiciones de tratamiento de datos que ofrecen nuestros proveedores, incluidas cláusulas contractuales tipo cuando estén disponibles. Contáctenos para más información.",
          ],
        },
        {
          id: "retention",
          heading: "6. Cuánto tiempo conservamos los datos",
          blocks: [
            {
              ul: [
                "Pedidos, pagos, reembolsos y facturas: el tiempo que exija la normativa fiscal y contable, y mientras sea posible una reclamación.",
                "Datos de la eSIM: mientras se conserve el pedido correspondiente, para poder ayudarle y tramitar reembolsos.",
                "Datos de la cuenta: mientras exista su cuenta. Cuando nos pida eliminarlos, los borramos o anonimizamos, salvo los registros que la ley nos obligue a conservar.",
                "Mensajes de soporte: el tiempo necesario para resolver su solicitud, más un plazo razonable para consultas posteriores.",
                "Analítica: seudónima; el consentimiento caduca como máximo a los 180 días.",
                "Sesiones y datos de limitación de abusos: solo hasta que caducan.",
              ],
            },
          ],
        },
        {
          id: "rights",
          heading: "7. Sus derechos",
          blocks: [
            "Según donde viva, puede solicitar el acceso, la rectificación, la supresión o la limitación de sus datos, recibir una copia (portabilidad), oponerse a los tratamientos basados en el interés legítimo y retirar su consentimiento. Use el [formulario de solicitud](/privacy/request) o escriba a {email}. Puede que necesitemos verificar su identidad. Respondemos en el plazo de un mes, o antes si la ley de su país lo exige.",
            "También puede reclamar ante la autoridad de protección de datos de su país (en España, la AEPD). Le agradeceríamos que nos diera antes la oportunidad de resolverlo.",
            "No tomamos decisiones basadas únicamente en un tratamiento automatizado que produzcan efectos jurídicos o significativos sobre usted. Los controles automáticos, como la verificación de pagos o la limitación de abusos, solo deciden si un pago coincide o si una solicitud está permitida. Una persona revisa cualquier caso problemático.",
          ],
        },
        {
          id: "security",
          heading: "8. Seguridad y brechas de datos",
          blocks: [
            "Protegemos los datos con medidas como conexiones cifradas, contraseñas y tokens de sesión guardados con hash, secretos de administración cifrados, controles de acceso, notificaciones de pago firmadas y registros de auditoría. Nunca recogemos números de tarjeta, claves privadas ni frases de recuperación.",
            "Si se produce una brecha de datos personales, la investigaremos y limitaremos su impacto. La notificaremos a las autoridades y a las personas afectadas cuando y como lo exija la ley.",
          ],
        },
        {
          id: "children",
          heading: "9. Menores",
          blocks: [
            "El servicio no está dirigido a menores y no recogemos conscientemente sus datos. Si cree que un menor nos ha facilitado datos, contáctenos y los eliminaremos.",
          ],
        },
        {
          id: "changes",
          heading: "10. Cambios",
          blocks: [
            "Actualizaremos esta política cuando cambie nuestro tratamiento, con un nuevo número de versión y una nueva fecha. Los cambios importantes se destacarán en el sitio web.",
          ],
        },
      ],
    }),

    cookies: (ctx) => ({
      title: "Política de cookies",
      description: "Las cookies y el almacenamiento del navegador que usa ESIMPROVE, y cómo aceptar, rechazar o retirar el consentimiento.",
      intro:
        "Esta política enumera las cookies y otros almacenamientos del navegador que usa ESIMPROVE y cómo controlarlos. Solo usamos lo necesario para que el sitio funcione, más una analítica opcional si usted la acepta.",
      sections: [
        {
          id: "consent",
          heading: "1. Cómo funciona el consentimiento",
          blocks: [
            "En su primera visita, un aviso le permite **rechazar** los almacenamientos opcionales, **aceptarlos** o **elegir** por categorías; las tres opciones son igual de sencillas. La analítica opcional no se carga hasta que usted la acepta, y rechazarla no afecta al carrito, al pago ni a su cuenta. Puede cambiar su elección en cualquier momento en **Configuración de cookies**, en el pie de página.",
            "Su elección se guarda en su navegador junto con la versión de la política. También conservamos un registro seudónimo en el servidor para poder respetarla. Una elección ausente o desactualizada nunca se considera consentimiento. El consentimiento para la analítica caduca a los 180 días.",
          ],
        },
        {
          id: "necessary",
          heading: "2. Almacenamiento estrictamente necesario",
          blocks: [
            "Estos elementos son necesarios para funciones que usted solicita (inicio de sesión, carrito, idioma, recordar su elección) y no requieren consentimiento.",
            {
              table: {
                caption: "Cookies y almacenamiento estrictamente necesarios",
                head: ["Nombre", "Tipo", "Finalidad", "Duración"],
                rows: [
                  ["esimprove_session", "Cookie (HTTP-only)", "Mantiene su sesión iniciada de forma segura", "Hasta 30 días (10 minutos durante el inicio de sesión en dos pasos)"],
                  ["cart_token", "Cookie (HTTP-only)", "Conserva los productos de su carrito", "30 días"],
                  ["esimprove_guest_orders", "Cookie (HTTP-only)", "Permite a este dispositivo volver a abrir los pedidos hechos como invitado, sin cuenta", "1 año, o hasta que los quite en Mis pedidos"],
                  ["esimprove_oauth", "Cookie (HTTP-only)", "Protege un inicio de sesión con Google o Apple mientras está en curso", "10 minutos"],
                  ["esimprove_locale", "Cookie", "Recuerda el idioma elegido", "1 año"],
                  ["es_consent_v1", "Almacenamiento local", "Recuerda su elección sobre cookies y su versión", "Hasta que la cambie o borre los datos del sitio"],
                  ["es_consent_id", "Almacenamiento local", "Identificador aleatorio que vincula su navegador con su registro de consentimiento (nosotros solo lo guardamos con hash)", "Hasta que borre los datos del sitio"],
                ],
              },
            },
          ],
        },
        {
          id: "analytics",
          heading: "3. Analítica opcional (solo con consentimiento)",
          blocks: [
            {
              table: {
                caption: "Almacenamiento de analítica opcional",
                head: ["Nombre", "Tipo", "Finalidad", "Duración"],
                rows: [
                  ["es_analytics_visitor", "Almacenamiento local", "Identificador seudónimo aleatorio de visitante para nuestra propia analítica (nosotros solo lo guardamos con hash)", "Hasta que borre los datos del sitio"],
                  ["es_analytics_session", "Almacenamiento de sesión", "Agrupa las páginas vistas en una misma visita", "Hasta que cierre la pestaña"],
                  ...(ctx.ga4Configured
                    ? [["_ga, _ga_*", "Cookies (Google)", "Medición de Google Analytics 4, con las funciones publicitarias desactivadas", "Hasta 2 años"]]
                    : []),
                ],
              },
            },
            ctx.ga4Configured
              ? "Google Analytics 4 solo se carga después de que acepte la analítica."
              : "Actualmente no se usa Google Analytics en este sitio.",
            "No usamos cookies publicitarias, de remarketing ni de redes sociales. Si eso cambiara, primero actualizaríamos esta política y le pediríamos su consentimiento.",
          ],
        },
        {
          id: "third-party",
          heading: "4. Páginas de pago",
          blocks: [
            "Cuando el pago con tarjeta esté disponible y lo elija, el formulario de pago lo proporciona nuestro proveedor de pagos (Whop). Puede usar sus propias cookies, necesarias para la seguridad y la prevención del fraude, según sus propias políticas.",
          ],
        },
        {
          id: "control",
          heading: "5. Cambiar su elección",
          blocks: [
            "Use **Configuración de cookies** en el pie de página para cambiar o retirar su consentimiento. Al retirarlo, la analítica se detiene desde ese momento. También puede borrar las cookies y los datos del sitio en los ajustes de su navegador; puede que luego tenga que iniciar sesión y elegir de nuevo. Además, respetamos las señales Do Not Track y Global Privacy Control y no recogemos analítica cuando están activadas.",
          ],
        },
      ],
    }),

    notice: () => ({
      title: "Aviso legal, contacto y reclamaciones",
      description: "Quién gestiona ESIMPROVE, cómo contactarnos y cómo se tramitan las reclamaciones.",
      intro:
        "Esta página ofrece la información del vendedor que podemos publicar actualmente y explica cómo contactarnos y presentar una reclamación.",
      sections: [
        {
          id: "seller",
          heading: "1. Vendedor",
          blocks: [
            "ESIMPROVE es una marca en línea que vende planes de datos eSIM prepago para viajar. La gestiona una persona física desde Vietnam. No es una sociedad registrada y no tiene número de registro mercantil ni de IVA. Los datos completos del vendedor figuran en el recuadro siguiente. Los datos aún no publicados se indican como tales en lugar de inventarse.",
          ],
        },
        {
          id: "contact",
          heading: "2. Contacto",
          blocks: [
            "Correo electrónico: {email}. Esta única dirección atiende soporte, reembolsos, reclamaciones y solicitudes de privacidad. No ofrecemos atención telefónica. También puede usar la [página de contacto](/contact) o el [formulario de solicitud de privacidad](/privacy/request).",
          ],
        },
        {
          id: "complaints",
          heading: "3. Cómo tramitamos las reclamaciones",
          blocks: [
            {
              ol: [
                "Envíe su reclamación a {email} con su número de pedido, qué ocurrió y qué solución desea.",
                "Le confirmamos la recepción en un plazo de 3 días hábiles.",
                "Le damos una respuesta completa en un plazo de 14 días. Si necesitamos más tiempo, por ejemplo para obtener información del proveedor, le explicamos el motivo y cuándo puede esperar la respuesta.",
                "Si no queda satisfecho, puede pedir que se revise de nuevo su reclamación o acudir a la autoridad de consumo o a un organismo de resolución alternativa de litigios de su país.",
              ],
            },
            "Reclamarnos no afecta a sus derechos legales, incluido el de acudir a los tribunales.",
          ],
        },
        {
          id: "content",
          heading: "4. Contenido del sitio",
          blocks: [
            "Procuramos que las descripciones de los planes, la cobertura y los precios sean exactos. Se basan en información de nuestro proveedor, y las redes pueden cambiar. Si encuentra un error, avísenos. Las marcas, como los nombres de dispositivos y redes, pertenecen a sus titulares y solo se usan para describir la compatibilidad y la cobertura.",
          ],
        },
      ],
    }),

    accessibility: () => ({
      title: "Declaración de accesibilidad",
      description: "Cómo procura ESIMPROVE ser utilizable por todos, sus limitaciones conocidas y cómo informar de una barrera.",
      intro:
        "Queremos que todas las personas puedan comprar y usar una eSIM con ESIMPROVE, incluidas las que usan tecnologías de apoyo.",
      sections: [
        {
          id: "measures",
          heading: "1. Qué hacemos",
          blocks: [
            {
              ul: [
                "Usamos una estructura de página semántica, formularios etiquetados e indicadores de foco visibles; el sitio se puede usar con el teclado.",
                "Usamos alternativas de texto en las imágenes con significado, y colores elegidos para un contraste legible.",
                "El sitio admite la lectura de derecha a izquierda en árabe y se adapta a pantallas de teléfono.",
                "Las eSIM pueden instalarse manualmente además de con código QR.",
              ],
            },
            "Nuestro objetivo es cumplir las pautas WCAG 2.2 de nivel AA. El sitio no ha pasado una auditoría de accesibilidad independiente, por lo que no afirmamos una conformidad total.",
          ],
        },
        {
          id: "limits",
          heading: "2. Limitaciones conocidas",
          blocks: [
            "Parte del contenido procede de terceros, como las descripciones de planes del proveedor o el formulario de pago con tarjeta, y puede no alcanzar el mismo nivel. Las características de los planes que facilita el proveedor se muestran por ahora en inglés.",
          ],
        },
        {
          id: "feedback",
          heading: "3. Informar de una barrera",
          blocks: [
            "Si tiene dificultades para usar alguna parte del sitio, escriba a {email} indicando la página y el problema. Le responderemos en un plazo de 5 días hábiles y, si hace falta, le ayudaremos a completar la compra de otra forma.",
          ],
        },
      ],
    }),
  },
};
