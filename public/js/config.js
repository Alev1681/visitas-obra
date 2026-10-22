/*
 * Configurações do app — edite este arquivo para personalizar.
 * Depois de alterar, aumente a versão em sw.js (CACHE) para os celulares receberem a atualização.
 */
window.CONFIG = {
  appNome: 'Visitas de Obra',
  empresa: 'Minha Empresa', // aparece no cabeçalho dos relatórios (pode ser trocado em Ajustes)
  versao: '1.0.0',

  // Cores da marca (Cores.png)
  cores: {
    azul: '#024089',
    amarelo: '#ffcc00',
    cinza: '#3d3d3c',
    grafite: '#2c2c2c',
    branco: '#ffffff',
  },

  tiposObra: ['Residencial', 'Condomínio / Prédio', 'Comercial', 'Industrial', 'Reforma', 'Obra pública', 'Outro'],

  etapas: [
    'Terraplenagem / Fundação',
    'Estrutura',
    'Alvenaria',
    'Instalações (elétrica / hidráulica)',
    'Cobertura / Telhado',
    'Revestimento / Acabamento',
    'Pintura',
    'Finalização / Entrega',
  ],

  cargos: ['Engenheiro(a)', 'Arquiteto(a)', 'Mestre de obras', 'Encarregado(a)', 'Comprador(a)', 'Proprietário(a)', 'Gestor(a) da construtora', 'Outro'],

  status: ['Novo contato', 'Em negociação', 'Proposta enviada', 'Aguardando retorno', 'Fechado', 'Perdido'],
  statusEncerrados: ['Fechado', 'Perdido'],

  materiaisMkt: ['Catálogo', 'Folder / Panfleto', 'Cartão de visita', 'Tabela de preços', 'Amostras', 'Brinde', 'Banner / Adesivo na obra'],

  categoriasFoto: ['Fachada / Placa da obra', 'Andamento da obra', 'Materiais em uso', 'Material de MKT entregue', 'Concorrência', 'Outro'],

  // Checklist diário de saída (tela "Checklist")
  checklist: [
    { grupo: 'Segurança (EPI)', itens: ['Capacete', 'Botina de segurança', 'Colete refletivo com logo', 'Óculos de proteção', 'Protetor auricular'] },
    { grupo: 'Equipamentos', itens: ['Celular carregado (acima de 80%)', 'Power bank carregado', 'Carregador veicular e cabo', 'Suporte veicular do celular', 'Trena'] },
    { grupo: 'Material de marketing', itens: ['Catálogos', 'Folders', 'Cartões de visita', 'Tabela de preços atualizada', 'Amostras', 'Brindes'] },
    { grupo: 'Veículo adesivado', itens: ['Adesivos limpos e sem danos', 'Combustível suficiente', 'Documento do veículo (CRLV digital)', 'Pneus calibrados'] },
    { grupo: 'Roteiro', itens: ['Roteiro do dia planejado', 'Retornos de hoje conferidos'] },
  ],

  foto: {
    maxLado: 1600,   // px — reduz o tamanho das fotos para caber muitas no celular
    qualidade: 0.8,  // JPEG 0–1
    carimbo: true,   // grava data/hora, GPS e obra na foto (comprovação da visita)
  },
};
