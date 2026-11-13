import { AudienceSegmentRecord } from '../types';

export type InterestArea =
  | 'Cultura & Som'
  | 'Esportes & Ação'
  | 'Tech & Inovação'
  | 'Fé & Valores'
  | 'Casa & Sabores'
  | 'Estilo & Beleza'
  | 'Negócios & Saber'
  | 'Hobbies & Mundo';

export interface GeneralInterestCard {
  id: string;
  label: string;
  area: InterestArea;
  emoji: string;
  relatedSubtopics: [string, string, string, string, string];
}

export interface RelatedSubtopicCard {
  id: string;
  label: string;
  parentId: string;
  parentLabel: string;
  emoji: string;
}

export const INTEREST_AREAS: InterestArea[] = [
  'Cultura & Som',
  'Esportes & Ação',
  'Tech & Inovação',
  'Fé & Valores',
  'Casa & Sabores',
  'Estilo & Beleza',
  'Negócios & Saber',
  'Hobbies & Mundo',
];

/**
 * Exatos 50 cards de interesses gerais diversos (cada um com 5 subtemas relacionados = 250 subtemas).
 */
export const GENERAL_INTEREST_CARDS: GeneralInterestCard[] = [
  {
    id: 'musica',
    label: 'Música',
    area: 'Cultura & Som',
    emoji: '🎵',
    relatedSubtopics: [
      'Fones Bluetooth e Caixas de Som',
      'Instrumentos Musicais e Violões',
      'Discos de Vinil e Vitrolas',
      'Shows, Festivais e Ingressos',
      'Equipamentos de Áudio e Estúdio',
    ],
  },
  {
    id: 'esportes',
    label: 'Esportes',
    area: 'Esportes & Ação',
    emoji: '🏅',
    relatedSubtopics: [
      'Roupas Esportivas e Dry-Fit',
      'Tênis de Alta Performance',
      'Bolas, Raquetes e Acessórios',
      'Garrafas Térmicas e Mochilas Esportivas',
      'Relógios e Monitores Esportivos',
    ],
  },
  {
    id: 'tecnologia',
    label: 'Tecnologia',
    area: 'Tech & Inovação',
    emoji: '💻',
    relatedSubtopics: [
      'Smartphones e Capas Protetoras',
      'Notebooks e Tablets para Produtividade',
      'Smartwatches e Wearables',
      'Carregadores Rápidos e Power Banks',
      'Gadgets de Automação e USB-C',
    ],
  },
  {
    id: 'religiao',
    label: 'Religião & Fé',
    area: 'Fé & Valores',
    emoji: '🙏',
    relatedSubtopics: [
      'Bíblias de Estudo e Devocionais',
      'Livros Espirituais e Oração',
      'Artigos Religiosos e Decoração Sacra',
      'Música Gospel e Louvor',
      'Eventos, Retiros e Grupos de Fé',
    ],
  },
  {
    id: 'saude_fitness',
    label: 'Saúde & Academia',
    area: 'Esportes & Ação',
    emoji: '💪',
    relatedSubtopics: [
      'Halteres, Elásticos e Treino em Casa',
      'Colchonetes, Yoga e Pilates',
      'Whey, Creatina e Coqueteleiras',
      'Balanças Digitais de Bioimpedância',
      'Massageadores Musculares Portáteis',
    ],
  },
  {
    id: 'culinaria',
    label: 'Culinária & Gastronomia',
    area: 'Casa & Sabores',
    emoji: '🍳',
    relatedSubtopics: [
      'Air Fryer e Eletroportáteis de Cozinha',
      'Panelas Antiaderentes e Frigideiras',
      'Facas Profissionais e Tábuas',
      'Temperos Especiais e Azeites',
      'Livros de Receitas e Confeitaria',
    ],
  },
  {
    id: 'viagens',
    label: 'Viagens & Turismo',
    area: 'Hobbies & Mundo',
    emoji: '✈️',
    relatedSubtopics: [
      'Malas de Bordo e Mochilas de Viagem',
      'Organizadores de Mala e Nécessaires',
      'Travesseiros de Pescoço e Conforto',
      'Adaptadores Universais de Tomada',
      'Guias de Destinos e Pacotes Turísticos',
    ],
  },
  {
    id: 'moda_estilo',
    label: 'Moda & Estilo',
    area: 'Estilo & Beleza',
    emoji: '👗',
    relatedSubtopics: [
      'Roupas Casuais e Básicos Essenciais',
      'Bolsas, Mochilas e Carteiras',
      'Óculos de Sol com Proteção UV',
      'Calçados Confortáveis do Dia a Dia',
      'Acessórios Minimalistas e Semijoias',
    ],
  },
  {
    id: 'casa_decoracao',
    label: 'Casa & Decoração',
    area: 'Casa & Sabores',
    emoji: '🛋️',
    relatedSubtopics: [
      'Organizadores Multiuso e Caixas',
      'Iluminação LED e Luminárias Quentes',
      'Jogos de Cama, Toalhas e Mantas',
      'Quadros Decorativos e Espelhos',
      'Aspiradores Robô e Praticidade no Lar',
    ],
  },
  {
    id: 'educacao_livros',
    label: 'Educação & Livros',
    area: 'Negócios & Saber',
    emoji: '📚',
    relatedSubtopics: [
      'Best-sellers de Desenvolvimento Pessoal',
      'Kindle e Leitores Digitais',
      'Cursos Online e Certificações',
      'Ficção, Romances e Biografias',
      'Luminárias de Leitura e Marca-Páginas',
    ],
  },
  {
    id: 'cinema_series',
    label: 'Cinema & Séries',
    area: 'Cultura & Som',
    emoji: '🎬',
    relatedSubtopics: [
      'Projetores Portáteis para Home Cinema',
      'Soundbars e TV Boxes Streaming',
      'Pipoqueiras Elétricas e Snacks',
      'Pôsteres e Colecionáveis de Filmes',
      'Fones Confortáveis para Maratonar',
    ],
  },
  {
    id: 'games',
    label: 'Games & eSports',
    area: 'Tech & Inovação',
    emoji: '🎮',
    relatedSubtopics: [
      'Controles, Headsets e Teclados Gamer',
      'Mouses Sem Fio e Mousepads XL',
      'Cadeiras Ergonômicas e Suportes RGB',
      'Jogos em Mídia Física e Gift Cards',
      'Consoles Portáteis e Acessórios',
    ],
  },
  {
    id: 'financas',
    label: 'Finanças & Investimentos',
    area: 'Negócios & Saber',
    emoji: '💰',
    relatedSubtopics: [
      'Livros de Educação Financeira e Bolsa',
      'Planilhas e Apps de Controle Financeiro',
      'Carteiras RFID e Cofres Discretos',
      'Cursos de Renda Extra e Investimentos',
      'Calculadoras e Escritório Doméstico',
    ],
  },
  {
    id: 'pets',
    label: 'Pets & Animais',
    area: 'Hobbies & Mundo',
    emoji: '🐾',
    relatedSubtopics: [
      'Comedouros Automáticos e Fontes de Água',
      'Brinquedos Interativos para Cães e Gatos',
      'Camas Pet Confortáveis e Arranhadores',
      'Petiscos Naturais e Higiene Pet',
      'Coleiras Peitorais e Transporte Seguro',
    ],
  },
  {
    id: 'maternidade_familia',
    label: 'Maternidade & Família',
    area: 'Fé & Valores',
    emoji: '👨‍👩‍👧‍👦',
    relatedSubtopics: [
      'Enxoval, Carrinhos e Cadeirinhas',
      'Brinquedos Educativos e Pedagógicos',
      'Mochilas Maternidade Térmicas',
      'Babás Eletrônicas e Segurança Infantil',
      'Jogos e Livros para Família Unida',
    ],
  },
  {
    id: 'beleza_autocuidado',
    label: 'Beleza & Autocuidado',
    area: 'Estilo & Beleza',
    emoji: '✨',
    relatedSubtopics: [
      'Sérums Faciais, Vitamina C e Protetor Solar',
      'Secadores, Escovas Modeladoras e Chapinhas',
      'Perfumes Importados e Nacionais',
      'Escovas Faciais e Espelhos com LED',
      'Hidratantes Corporais e Óleos Essenciais',
    ],
  },
  {
    id: 'empreendedorismo',
    label: 'Empreendedorismo',
    area: 'Negócios & Saber',
    emoji: '🚀',
    relatedSubtopics: [
      'Maquininhas de Cartão e Impressoras Térmicas',
      'Ring Lights para Gravar Vídeos e Reels',
      'Embalagens Personalizadas para E-commerce',
      'Livros de Gestão, Vendas e Marketing',
      'Microfones de Lapela Sem Fio',
    ],
  },
  {
    id: 'carros_motos',
    label: 'Carros & Motos',
    area: 'Hobbies & Mundo',
    emoji: '🚗',
    relatedSubtopics: [
      'Suportes Veiculares Magnéticos e Carregadores',
      'Aspiradores Automotivos Portáteis',
      'Ceras, Limpadores e Estética Automotiva',
      'Câmeras Veiculares (Dashcam) e Sensores',
      'Capacetes, Luvas e Baús para Motos',
    ],
  },
  {
    id: 'jardinagem',
    label: 'Plantas & Jardinagem',
    area: 'Casa & Sabores',
    emoji: '🪴',
    relatedSubtopics: [
      'Vasos Autoirrigáveis e Cachepôs',
      'Kits de Ferramentas de Jardinagem',
      'Sementes de Temperos e Horta em Casa',
      'Substratos, Adubos e Borrifadores',
      'Suportes Macramê e Prateleiras para Plantas',
    ],
  },
  {
    id: 'fotografia',
    label: 'Fotografia & Vídeo',
    area: 'Cultura & Som',
    emoji: '📸',
    relatedSubtopics: [
      'Tripés Dobráveis e Estabilizadores Gimbal',
      'Iluminadores LED Portáteis RGB',
      'Lentes para Celular e Câmeras de Ação',
      'Cartões de Memória Rápidos e HDs Externos',
      'Impressoras Instantâneas de Fotos',
    ],
  },
  {
    id: 'artesanato_diy',
    label: 'Artesanato & DIY',
    area: 'Hobbies & Mundo',
    emoji: '🧶',
    relatedSubtopics: [
      'Kits de Crochê, Tricô e Linhas',
      'Máquinas de Costura Portáteis',
      'Pistolas de Cola Quente e Ferramentas Finas',
      'Tintas Acrílicas, Pincéis e Telas',
      'Resina Epóxi, Moldes e Velas Artesanais',
    ],
  },
  {
    id: 'cafe_bebidas',
    label: 'Café & Cafeteria',
    area: 'Casa & Sabores',
    emoji: '☕',
    relatedSubtopics: [
      'Cafeteiras Espresso, Prensa Francesa e V60',
      'Moedores de Café Manuais e Elétricos',
      'Grãos Especiais Torra Média e Cápsulas',
      'Espumadores de Leite e Canecas Térmicas',
      'Chaleiras Bico de Ganso com Termômetro',
    ],
  },
  {
    id: 'churrasco_lazer',
    label: 'Churrasco & Lazer',
    area: 'Casa & Sabores',
    emoji: '🥩',
    relatedSubtopics: [
      'Kits de Facas e Garfos de Churrasco',
      'Churrasqueiras Portáteis e Grelhas Inox',
      'Coolers e Copos Térmicos com Tampa',
      'Tábuas de Madeira Nobre com Canaleta',
      'Acendedores Elétricos e Temperos Dry Rub',
    ],
  },
  {
    id: 'sustentabilidade',
    label: 'Sustentabilidade & Eco',
    area: 'Fé & Valores',
    emoji: '🌱',
    relatedSubtopics: [
      'Copos, Canudos e Sacolas Reutilizáveis',
      'Composteiras Domésticas Orgânicas',
      'Cosméticos Veganos e Biodegradáveis',
      'Pilhas Recarregáveis e Economizadores',
      'Moda Consciente e Materiais Reciclados',
    ],
  },
  {
    id: 'danca',
    label: 'Dança & Ritmos',
    area: 'Cultura & Som',
    emoji: '💃',
    relatedSubtopics: [
      'Tênis Leves e Sapatilhas de Dança',
      'Roupas Fluidas para Treino e Ensaio',
      'Caixas de Som com Graves Potentes',
      'Espelhos Amplos e Tapetes Antiderrapantes',
      'Aulas Online de Ritmos e Coreografias',
    ],
  },
  {
    id: 'teatro_arte',
    label: 'Teatro & Cultura',
    area: 'Cultura & Som',
    emoji: '🎭',
    relatedSubtopics: [
      'Livros de Dramaturgia e História da Arte',
      'Cadernos de Anotações e Roteiros',
      'Ingressos para Museus e Exposições',
      'Bolsas Tote Culturais e Ecobags Artísticas',
      'Iluminação e Som para Ensaios',
    ],
  },
  {
    id: 'podcasts_radio',
    label: 'Podcasts & Áudio',
    area: 'Cultura & Som',
    emoji: '🎙️',
    relatedSubtopics: [
      'Microfones USB Condensadores para Voz',
      'Braços Articulados e Pop Filters',
      'Fones Over-Ear de Referência Confortáveis',
      'Interfaces de Áudio Compactas',
      'Audiolivros e Assinaturas de Conteúdo',
    ],
  },
  {
    id: 'direito_cidadania',
    label: 'Direito & Concursos',
    area: 'Negócios & Saber',
    emoji: '⚖️',
    relatedSubtopics: [
      'Vade Mecum e Códigos Atualizados',
      'Cadernos Inteligentes e Marca-Textos',
      'Suportes Ergonômicos de Notebook para Estudo',
      'Cursos Preparatórios e Mentorias',
      'Pastas Executivas e Mochilas Antifurto',
    ],
  },
  {
    id: 'arquitetura_design',
    label: 'Arquitetura & Design',
    area: 'Negócios & Saber',
    emoji: '📐',
    relatedSubtopics: [
      'Trenas a Laser Digitais e Escalímetros',
      'Monitores Ultrawide de Alta Fidelidade',
      'Mesas Digitalizadoras e Canetas Touch',
      'Livros de Interiores e Paisagismo',
      'Objetos de Design Escandinavo e Minimalista',
    ],
  },
  {
    id: 'agro_campo',
    label: 'Agronegócio & Campo',
    area: 'Hobbies & Mundo',
    emoji: '🌾',
    relatedSubtopics: [
      'Botas Impermeáveis e Roupas de Trabalho',
      'Chapéus com Proteção Solar UV50',
      'Lanternas Táticas Recarregáveis de Longo Alcance',
      'Canivetes Multiuso e Facões de Aço',
      'Garrafas Térmicas Gigantes para Tereré/Chimarrão',
    ],
  },
  {
    id: 'ciclismo',
    label: 'Ciclismo & Pedal',
    area: 'Esportes & Ação',
    emoji: '🚴',
    relatedSubtopics: [
      'Capacetes Aerodinâmicos e Óculos de Pedal',
      'Faróis Recarregáveis e Lanternas Traseiras',
      'Bretelles, Camisas com Bolsos e Luvas',
      'Bombas Portáteis e Kits Reparo de Pneu',
      'Ciclocomputadores GPS e Suportes',
    ],
  },
  {
    id: 'corrida',
    label: 'Corrida & Maratona',
    area: 'Esportes & Ação',
    emoji: '🏃',
    relatedSubtopics: [
      'Tênis com Placa e Amortecimento Leve',
      'Pochetes Finas e Cintos de Hidratação',
      'Meias de Compressão Antibolha',
      'Fones Esportivos Resistentes a Suor',
      'Géis de Carboidrato e Isotônicos',
    ],
  },
  {
    id: 'pesca_camping',
    label: 'Pesca & Camping',
    area: 'Esportes & Ação',
    emoji: '⛺',
    relatedSubtopics: [
      'Barracas Impermeáveis e Sacos de Dormir',
      'Cadeiras Dobráveis Ultraleves e Mesas',
      'Varas Telescópicas, Molinetes e Iscas',
      'Fogareiros Portáteis e Kits de Cozinha Camp',
      'Painéis Solares Dobráveis para Acampamento',
    ],
  },
  {
    id: 'ciencia_astronomia',
    label: 'Ciência & Astronomia',
    area: 'Negócios & Saber',
    emoji: '🔭',
    relatedSubtopics: [
      'Telescópios Refratores e Binóculos Potentes',
      'Globos Terrestres e Mapas Estelares',
      'Luminárias Lua 3D e Projetores de Galáxia',
      'Livros de Divulgação Científica e Física',
      'Microscópios Digitais USB',
    ],
  },
  {
    id: 'idiomas',
    label: 'Idiomas & Culturas',
    area: 'Negócios & Saber',
    emoji: '🌎',
    relatedSubtopics: [
      'Dicionários Bilíngues e Gramáticas Práticas',
      'Apps e Cursos de Conversação Online',
      'Flashcards e Cadernos de Vocabulário',
      'Fones com Microfone Limpo para Aulas',
      'Livros Originais em Inglês e Espanhol',
    ],
  },
  {
    id: 'voluntariado',
    label: 'Causas Sociais & Ongs',
    area: 'Fé & Valores',
    emoji: '🤝',
    relatedSubtopics: [
      'Produtos de Marcas com Impacto Social',
      'Livros sobre Cidadania e Transformação',
      'Kits Escolares e Materiais para Doação',
      'Rações e Itens para Abrigos de Animais',
      'Camisetas e Bonés de Projetos Solidários',
    ],
  },
  {
    id: 'jogos_tabuleiro',
    label: 'Jogos de Tabuleiro',
    area: 'Hobbies & Mundo',
    emoji: '🎲',
    relatedSubtopics: [
      'Board Games Estratégicos Modernos',
      'Jogos de Cartas Rápidos para Amigos',
      'Quebra-Cabeças 1000+ Peças',
      'Baralhos Profissionais e Fichas de Poker',
      'Protetores de Cartas (Sleeves) e Dados RPG',
    ],
  },
  {
    id: 'meditacao_bemestar',
    label: 'Meditação & Mente Leve',
    area: 'Fé & Valores',
    emoji: '🧘',
    relatedSubtopics: [
      'Difusores Ultrassônicos de Aromas',
      'Almofadas de Meditação (Zafu) e Tapetes',
      'Diários de Gratidão e Saúde Emocional',
      'Chás Relaxantes de Camomila e Lavanda',
      'Máscaras de Dormir Seda e Ruído Branco',
    ],
  },
  {
    id: 'relogios_acessorios',
    label: 'Relógios & Acessórios',
    area: 'Estilo & Beleza',
    emoji: '⌚',
    relatedSubtopics: [
      'Relógios Clássicos Analógicos e Automáticos',
      'Pulseiras Extras de Couro, Aço e Silicone',
      'Estojos Organizadores de Relógios',
      'Cintos de Couro e Carteiras Slim',
      'Canetas Metálicas de Uso Diário',
    ],
  },
  {
    id: 'papelaria',
    label: 'Papelaria & Organização',
    area: 'Casa & Sabores',
    emoji: '📝',
    relatedSubtopics: [
      'Planners, Agendas e Cadernos Pontilhados',
      'Canetas Coloridas Fineliner e Brush Pen',
      'Blocos Adesivos, Clips e Marcadores',
      'Organizadores de Mesa e Porta-Canetas',
      'Etiquetadoras Portáteis Bluetooth',
    ],
  },
  {
    id: 'vinhos_cervejas',
    label: 'Vinhos & Cervejas',
    area: 'Casa & Sabores',
    emoji: '🍷',
    relatedSubtopics: [
      'Abridores Elétricos de Vinho e Aeradores',
      'Taças de Cristal e Copos Específicos',
      'Adegas Climatizadas Compactas',
      'Kits de Cervejas Artesanais IPA e Weiss',
      'Tábuas de Frios e Queijeiras',
    ],
  },
  {
    id: 'ferramentas_oficina',
    label: 'Ferramentas & Oficina',
    area: 'Tech & Inovação',
    emoji: '🛠️',
    relatedSubtopics: [
      'Parafusadeiras Sem Fio à Bateria Lítio',
      'Maletas Completas de Chaves e Soquetes',
      'Chaves de Precisão para Eletrônicos',
      'Multímetros Digitais e Níveis a Laser',
      'Organizadores Modulares de Parafusos',
    ],
  },
  {
    id: 'cultura_geek',
    label: 'Cultura Geek & Mangás',
    area: 'Cultura & Som',
    emoji: '🦸',
    relatedSubtopics: [
      'Mangás, HQs e Graphic Novels',
      'Action Figures e Colecionáveis Oficiais',
      'Camisetas Estampadas de Anime e Sci-Fi',
      'Canecas Temáticas e Luminárias Neon',
      'Mochilas Executivas com Pins Colecionáveis',
    ],
  },
  {
    id: 'imoveis_moradia',
    label: 'Imóveis & Reformas',
    area: 'Casa & Sabores',
    emoji: '🏠',
    relatedSubtopics: [
      'Fechaduras Digitais Biométricas',
      'Torneiras Gourmet e Duchas Modernas',
      'Papéis de Parede Autocolantes Laváveis',
      'Pisos Vinílicos e Rodapés Práticos',
      'Prateleiras Flutuantes e Nichos',
    ],
  },
  {
    id: 'energia_solar_smart',
    label: 'Casa Conectada & Solar',
    area: 'Tech & Inovação',
    emoji: '☀️',
    relatedSubtopics: [
      'Refletores Solares com Sensor de Movimento',
      'Tomadas Inteligentes Wi-Fi com Medidor',
      'Câmeras de Segurança Wi-Fi Internas/Externas',
      'Lâmpadas Smart Compatíveis com Alexa/Google',
      'Interruptores Touch Sem Neutro',
    ],
  },
  {
    id: 'futebol_torcida',
    label: 'Futebol & Torcida',
    area: 'Esportes & Ação',
    emoji: '⚽',
    relatedSubtopics: [
      'Camisas Oficiais de Clubes e Seleções',
      'Chuteiras Campo, Society e Futsal',
      'Copos e Bandeiras Personalizadas do Time',
      'Bolas Costuradas Profissionais e Bombas',
      'Churrasqueiras e Itens para Dia de Jogo',
    ],
  },
  {
    id: 'artes_marciais',
    label: 'Artes Marciais & Lutas',
    area: 'Esportes & Ação',
    emoji: '🥋',
    relatedSubtopics: [
      'Kimonos Reforçados e Faixas Graduadas',
      'Luvas de Boxe, Bandagens e Caneleiras',
      'Sacos de Pancada e Aparadores de Chute',
      'Rashguards e Bermudas de Compressão',
      'Protetores Bucais Moldáveis',
    ],
  },
  {
    id: 'nutricao_suplementos',
    label: 'Nutrição & Vida Saudável',
    area: 'Esportes & Ação',
    emoji: '🥗',
    relatedSubtopics: [
      'Vitaminas, Ômega 3 e Magnésio',
      'Marmitas Herméticas e Bolsas Térmicas Fit',
      'Mixers e Liquidificadores Portáteis USB',
      'Snacks Proteicos, Castanhas e Pastas',
      'Balanças de Precisão para Dieta',
    ],
  },
  {
    id: 'maquiagem_skincare',
    label: 'Maquiagem & Skincare',
    area: 'Estilo & Beleza',
    emoji: '💄',
    relatedSubtopics: [
      'Bases, Corretivos e Pós Translucidos',
      'Kits de Pincéis Macios e Esponjas',
      'Águas Micelares e Sabonetes Faciais',
      'Maletas Organizadoras de Maquiagem',
      'Gloss, Batons Matte e Máscaras de Cílios',
    ],
  },
  {
    id: 'humor_entretenimento',
    label: 'Humor & Entretenimento',
    area: 'Cultura & Som',
    emoji: '😂',
    relatedSubtopics: [
      'Ingressos de Stand-Up Comedy e Shows',
      'Jogos Divertidos de Perguntas para Grupos',
      'Presentes Criativos e Canecas Engraçadas',
      'Livros de Crônicas e Humor Brasileiro',
      'Camisetas com Frases e Cultura Pop',
    ],
  },
];

export const GENERAL_INTEREST_BY_ID = new Map(
  GENERAL_INTEREST_CARDS.map((c) => [c.id, c])
);

export const findInterestLabel = (idOrLabel: string): string => {
  const byId = GENERAL_INTEREST_BY_ID.get(idOrLabel);
  if (byId) return byId.label;
  const clean = idOrLabel.trim().toLowerCase();
  const byLabel = GENERAL_INTEREST_CARDS.find((c) => c.label.toLowerCase() === clean);
  return byLabel ? byLabel.label : idOrLabel;
};

/**
 * Gera exatamente 50 subtemas relacionados a partir das 10 escolhas gerais do usuário
 * (fallback determinístico imediato se a IA não responder ou completar até 50).
 */
export function buildFallbackSubtopicsForInterests(
  selectedGeneralIdsOrLabels: string[],
  targetCount = 50
): RelatedSubtopicCard[] {
  const matchedParents: GeneralInterestCard[] = [];
  for (const token of selectedGeneralIdsOrLabels) {
    const clean = token.trim().toLowerCase();
    const card =
      GENERAL_INTEREST_CARDS.find(
        (c) => c.id.toLowerCase() === clean || c.label.toLowerCase() === clean
      ) || null;
    if (card && !matchedParents.some((p) => p.id === card.id)) {
      matchedParents.push(card);
    }
  }

  // Fallback safety if fewer than 10 passed
  if (matchedParents.length < 10) {
    for (const c of GENERAL_INTEREST_CARDS) {
      if (matchedParents.length >= 10) break;
      if (!matchedParents.some((p) => p.id === c.id)) {
        matchedParents.push(c);
      }
    }
  }

  const out: RelatedSubtopicCard[] = [];
  const seenLabels = new Set<string>();

  for (const parent of matchedParents) {
    parent.relatedSubtopics.forEach((sub, idx) => {
      const norm = sub.toLowerCase();
      if (!seenLabels.has(norm) && out.length < targetCount) {
        seenLabels.add(norm);
        out.push({
          id: `${parent.id}_sub_${idx}`,
          label: sub,
          parentId: parent.id,
          parentLabel: parent.label,
          emoji: parent.emoji,
        });
      }
    });
  }

  // Top up to targetCount if fewer than 50 unique items
  let extraIdx = 0;
  while (out.length < targetCount && extraIdx < GENERAL_INTEREST_CARDS.length) {
    const c = GENERAL_INTEREST_CARDS[extraIdx++];
    for (let j = 0; j < c.relatedSubtopics.length && out.length < targetCount; j++) {
      const sub = c.relatedSubtopics[j];
      const norm = sub.toLowerCase();
      if (!seenLabels.has(norm)) {
        seenLabels.add(norm);
        out.push({
          id: `${c.id}_extra_${j}`,
          label: sub,
          parentId: c.id,
          parentLabel: c.label,
          emoji: c.emoji,
        });
      }
    }
  }

  return out.slice(0, targetCount);
}

export interface TopicIntersectionCluster {
  key: string;
  topics: string[]; // Labels of intersected general topics
  count: number;
  percentage: number;
  topGender: string;
  topAgeBracket: string;
  topRelatedSubtopics: Array<{ label: string; count: number }>;
}

export interface CustomIntersectionSummary {
  selectedTopics: string[];
  matchedUsersCount: number;
  totalUsersCount: number;
  percentage: number;
  genderBreakdown: Array<{ label: string; count: number }>;
  ageBreakdown: Array<{ label: string; count: number }>;
  topSubtopics: Array<{ label: string; count: number }>;
}

const normalizeTopic = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/**
 * Agrupa usuários em conjuntos de assuntos que se interseccionam (pares, trios e temas principais)
 * para leitura rápida de público-alvo pelo administrador.
 */
export function computeAudienceIntersections(
  segments: AudienceSegmentRecord[]
): {
  totalProfilesWithInterests: number;
  topicCounts: Array<{ label: string; count: number; percentage: number }>;
  pairClusters: TopicIntersectionCluster[];
  trioClusters: TopicIntersectionCluster[];
} {
  const validSegments = segments.filter(
    (s) => Array.isArray(s.generalInterests) && s.generalInterests.length > 0
  );
  const total = validSegments.length;

  const singleMap = new Map<string, { label: string; users: AudienceSegmentRecord[] }>();
  const pairMap = new Map<string, { topics: string[]; users: AudienceSegmentRecord[] }>();
  const trioMap = new Map<string, { topics: string[]; users: AudienceSegmentRecord[] }>();

  for (const seg of validSegments) {
    // Deduplicate user's topics cleanly with display label
    const uniqueLabels: string[] = [];
    const seen = new Set<string>();
    for (const raw of seg.generalInterests) {
      const display = findInterestLabel(raw);
      const norm = normalizeTopic(display);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        uniqueLabels.push(display);
      }
    }
    uniqueLabels.sort((a, b) => a.localeCompare(b, 'pt-BR'));

    for (const lbl of uniqueLabels) {
      const norm = normalizeTopic(lbl);
      const entry = singleMap.get(norm) || { label: lbl, users: [] };
      entry.users.push(seg);
      singleMap.set(norm, entry);
    }

    for (let i = 0; i < uniqueLabels.length; i++) {
      for (let j = i + 1; j < uniqueLabels.length; j++) {
        const pairTopics = [uniqueLabels[i], uniqueLabels[j]];
        const pairKey = pairTopics.map(normalizeTopic).join('__');
        const entry = pairMap.get(pairKey) || { topics: pairTopics, users: [] };
        entry.users.push(seg);
        pairMap.set(pairKey, entry);

        for (let k = j + 1; k < uniqueLabels.length; k++) {
          const trioTopics = [uniqueLabels[i], uniqueLabels[j], uniqueLabels[k]];
          const trioKey = trioTopics.map(normalizeTopic).join('__');
          const tEntry = trioMap.get(trioKey) || { topics: trioTopics, users: [] };
          tEntry.users.push(seg);
          trioMap.set(trioKey, tEntry);
        }
      }
    }
  }

  const summarizeCluster = (
    key: string,
    topics: string[],
    users: AudienceSegmentRecord[]
  ): TopicIntersectionCluster => {
    const gMap = new Map<string, number>();
    const aMap = new Map<string, number>();
    const subMap = new Map<string, number>();

    for (const u of users) {
      const g = u.gender && u.gender !== 'Prefiro não declarar' ? u.gender : 'Não declarado';
      gMap.set(g, (gMap.get(g) || 0) + 1);

      const a = u.ageBracket || 'Não declarado';
      aMap.set(a, (aMap.get(a) || 0) + 1);

      for (const sub of u.relatedInterests || []) {
        subMap.set(sub, (subMap.get(sub) || 0) + 1);
      }
    }

    const topGender =
      Array.from(gMap.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] || 'Todos';
    const topAgeBracket =
      Array.from(aMap.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] || 'Todas as idades';
    const topRelatedSubtopics = Array.from(subMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 4);

    return {
      key,
      topics,
      count: users.length,
      percentage: total > 0 ? Math.round((users.length / total) * 100) : 0,
      topGender,
      topAgeBracket,
      topRelatedSubtopics,
    };
  };

  const topicCounts = Array.from(singleMap.values())
    .map((e) => ({
      label: e.label,
      count: e.users.length,
      percentage: total > 0 ? Math.round((e.users.length / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const pairClusters = Array.from(pairMap.entries())
    .map(([key, val]) => summarizeCluster(key, val.topics, val.users))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const trioClusters = Array.from(trioMap.entries())
    .map(([key, val]) => summarizeCluster(key, val.topics, val.users))
    .filter((c) => c.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalProfilesWithInterests: total,
    topicCounts,
    pairClusters,
    trioClusters,
  };
}

/**
 * Calcula exatamente quantas pessoas pertencem à interseção lógica (E / AND)
 * de todos os assuntos selecionados pelo Administrador.
 */
export function filterAudienceIntersection(
  segments: AudienceSegmentRecord[],
  selectedTopicLabels: string[]
): CustomIntersectionSummary {
  const validSegments = segments.filter(
    (s) => Array.isArray(s.generalInterests) && s.generalInterests.length > 0
  );
  const targets = selectedTopicLabels.map(normalizeTopic).filter(Boolean);

  const matched = validSegments.filter((seg) => {
    if (targets.length === 0) return true;
    const userTopics = new Set(
      [...(seg.generalInterests || []), ...(seg.relatedInterests || [])]
        .map(findInterestLabel)
        .map(normalizeTopic)
    );
    return targets.every((t) => userTopics.has(t));
  });

  const gMap = new Map<string, number>();
  const aMap = new Map<string, number>();
  const subMap = new Map<string, number>();

  for (const u of matched) {
    const g = u.gender || 'Prefiro não declarar';
    gMap.set(g, (gMap.get(g) || 0) + 1);
    const a = u.ageBracket || 'Não declarado';
    aMap.set(a, (aMap.get(a) || 0) + 1);
    for (const sub of u.relatedInterests || []) {
      subMap.set(sub, (subMap.get(sub) || 0) + 1);
    }
  }

  return {
    selectedTopics: selectedTopicLabels,
    matchedUsersCount: matched.length,
    totalUsersCount: validSegments.length,
    percentage:
      validSegments.length > 0
        ? Math.round((matched.length / validSegments.length) * 100)
        : 0,
    genderBreakdown: Array.from(gMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    ageBreakdown: Array.from(aMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    topSubtopics: Array.from(subMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}
