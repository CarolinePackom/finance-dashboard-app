import React, { useState, useMemo, useCallback, memo } from 'react';
// Tree-shaking: importer uniquement les composants utilises
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Filter,
  Calendar,
  PiggyBank,
  ShoppingCart,
  Home,
  Car,
  Utensils,
  Gamepad,
  Smartphone,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react';

// =============================================================================
// OPTIMISATIONS APPLIQUEES:
// 1. memo() sur tous les sous-composants pour eviter les re-renders inutiles
// 2. useCallback() pour tous les handlers passes en props
// 3. useMemo() pour les calculs couteux (stats, categoryData, filteredTransactions)
// 4. Extraction des constantes (COLORS, formatters) hors du composant
// 5. Utilisation de Map/Set pour les lookups O(1) au lieu de includes/forEach
// 6. Cle unique stable pour les lignes de transaction (evite l'index seul)
// 7. Composants graphiques memoises separement pour isolation des re-renders
// =============================================================================

// Donnees externalisees pour meilleur tree-shaking et possibilite de lazy loading
// Dans un vrai projet, cela viendrait d'une API ou d'un fichier JSON separe
const transactionsData = [
  {"date": "2025-11-30", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR INST de MONSIEUR LE CERF NIC", "debit": 0, "credit": 30, "category": "Virements reçus"},
  {"date": "2025-11-28", "type": "PAIEMENT PAR CARTE", "detail": "X6374 E.LECLERC WEB CHAMPF 27/11", "debit": 131.52, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-28", "type": "PRELEVEMENT", "detail": "Bouygues Telecom 09xxxxx933", "debit": 32.77, "credit": 0, "category": "Télécom"},
  {"date": "2025-11-27", "type": "PAIEMENT PAR CARTE", "detail": "X6374 PatheEUR Paris 26/11", "debit": 24.4, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-27", "type": "VIREMENT EMIS", "detail": "VIR INST vers Anne Laure Baudin", "debit": 40, "credit": 0, "category": "Virements émis"},
  {"date": "2025-11-27", "type": "PAIEMENT PAR CARTE", "detail": "X5239 LE FOUR A BOIS REIMS 26/11", "debit": 7.9, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-27", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 26/11", "debit": 3.5, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-26", "type": "AVOIR", "detail": "CARTE X6374 MGP*Vinted 25/11", "debit": 0, "credit": 4.54, "category": "Shopping"},
  {"date": "2025-11-25", "type": "PRELEVEMENT", "detail": "ENGIE Mandat 00S018380175", "debit": 142.37, "credit": 0, "category": "Logement & Énergie"},
  {"date": "2025-11-25", "type": "PAIEMENT PAR CARTE", "detail": "X6374 AMAZON PAYMENTS PAYL 24/11", "debit": 7.99, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MGP*Vinted Vilnius 23/11", "debit": 8.69, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MP*CARREFOUR REIMS 22/11", "debit": 40.64, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 23/11", "debit": 14.3, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 21/11", "debit": 13.3, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X6374 AMZ DIGITAL FRA PAYL 21/11", "debit": 12.99, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X6374 P Julianne REIMS 21/11", "debit": 8.45, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MGP*Vinted Vilnius 22/11", "debit": 8.09, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 23/11", "debit": 7.9, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-24", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 22/11", "debit": 1.1, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-21", "type": "COTISATION", "detail": "Offre Essentiel", "debit": 9, "credit": 0, "category": "Banque & Frais"},
  {"date": "2025-11-20", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 20/11", "debit": 5.5, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-20", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 19/11", "debit": 16.55, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-19", "type": "VIREMENT EMIS", "detail": "VIR INST vers Mathilde Le Cerf", "debit": 150, "credit": 0, "category": "Virements émis"},
  {"date": "2025-11-19", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MP*CARREFOUR REIMS 18/11", "debit": 25.44, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-19", "type": "PAIEMENT PAR CARTE", "detail": "X6374 JOUE CLUB CORMONT 18/11", "debit": 17.99, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-19", "type": "PAIEMENT PAR CARTE", "detail": "X6374 FNAC REIMS CHAMPAGN 18/11", "debit": 12.99, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-19", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 18/11", "debit": 4.8, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-18", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MP*CARREFOUR REIMS 15/11", "debit": 42.49, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-18", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 18/11", "debit": 4.25, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-18", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 16/11", "debit": 3.15, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-17", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR INST de CAROLINE WIRTH", "debit": 0, "credit": 150, "category": "Virements reçus"},
  {"date": "2025-11-17", "type": "PAIEMENT PAR CARTE", "detail": "X6374 Pathe Gaumont Tickets 15/11", "debit": 20.5, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-17", "type": "PAIEMENT PAR CARTE", "detail": "X6374 FRNK ET ROZE REIMS 15/11", "debit": 12.9, "credit": 0, "category": "Restaurants"},
  {"date": "2025-11-17", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MGP*Vinted Vilnius 14/11", "debit": 7.79, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-17", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 15/11", "debit": 7.7, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-17", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 14/11", "debit": 4.7, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-14", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR INST de Mathilde Le Cerf", "debit": 0, "credit": 938.68, "category": "Salaire"},
  {"date": "2025-11-14", "type": "VIREMENT EMIS", "detail": "VIR INST vers Mathilde Le Cerf", "debit": 938.68, "credit": 0, "category": "Salaire"},
  {"date": "2025-11-14", "type": "PAIEMENT PAR CARTE", "detail": "X6374 Spotify P221C6FE38 13/11", "debit": 5.99, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-14", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 13/11", "debit": 5.7, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-13", "type": "AVOIR", "detail": "CARTE X6374 MGP*Vinted 12/11", "debit": 0, "credit": 6.96, "category": "Remboursements"},
  {"date": "2025-11-13", "type": "PAIEMENT PAR CARTE", "detail": "X6374 AMAZON PAYMENTS PAYL 12/11", "debit": 59.99, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-13", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 12/11", "debit": 9.8, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-13", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 12/11", "debit": 8.2, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-13", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 11/11", "debit": 5.2, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-12", "type": "PRELEVEMENT", "detail": "Freenow", "debit": 15.93, "credit": 0, "category": "Prélèvements"},
  {"date": "2025-11-12", "type": "AVOIR", "detail": "CARTE X6374 VEEPEE.FR 11/11", "debit": 0, "credit": 24.54, "category": "Remboursements"},
  {"date": "2025-11-12", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MP*CARREFOUR REIMS 10/11", "debit": 35.96, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-12", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 11/11", "debit": 7.6, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-11", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR INST de CAROLINE WIRTH", "debit": 0, "credit": 55, "category": "Virements reçus"},
  {"date": "2025-11-11", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MGP*Vinted Vilnius 08/11", "debit": 14.99, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-11", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MC DONALD S AM REIMS 10/11", "debit": 12.3, "credit": 0, "category": "Restaurants"},
  {"date": "2025-11-11", "type": "PAIEMENT PAR CARTE", "detail": "X6374 AMAZON PAYMENTS PAYL 10/11", "debit": 10.31, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-11", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 10/11", "debit": 7.3, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-11", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 09/11", "debit": 6.5, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-11", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 08/11", "debit": 5.3, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-10", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR de DGSN - COM GENERALES", "debit": 0, "credit": 38.18, "category": "Virements reçus"},
  {"date": "2025-11-10", "type": "PRELEVEMENT", "detail": "FREEBOXV6-D1FD25 4269xxxxxx", "debit": 29.99, "credit": 0, "category": "Prélèvements"},
  {"date": "2025-11-10", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MGP*Vinted Vilnius 08/11", "debit": 8.49, "credit": 0, "category": "Shopping"},
  {"date": "2025-11-10", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 09/11", "debit": 5.5, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-08", "type": "VIREMENT EMIS", "detail": "VIR vers CAROLINE WIRTH", "debit": 10, "credit": 0, "category": "Virements émis"},
  {"date": "2025-11-07", "type": "COTISATION", "detail": "COTISATION ASSURANCE DU COM", "debit": 32, "credit": 0, "category": "Banque & Frais"},
  {"date": "2025-11-07", "type": "PRELEVEMENT", "detail": "NETFLIX.COM 866-579-7172", "debit": 20.99, "credit": 0, "category": "Prélèvements"},
  {"date": "2025-11-07", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MC DONALD S AM REIMS 06/11", "debit": 12.3, "credit": 0, "category": "Restaurants"},
  {"date": "2025-11-07", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 06/11", "debit": 5.2, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-06", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MC DONALD S AM REIMS 05/11", "debit": 12.5, "credit": 0, "category": "Restaurants"},
  {"date": "2025-11-06", "type": "PAIEMENT PAR CARTE", "detail": "X6374 SACREES SAVEURS REIM 05/11", "debit": 5.2, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-05", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR de DGSN - COM GENERALES", "debit": 0, "credit": 30, "category": "Logement & Énergie"},
  {"date": "2025-11-05", "type": "PRELEVEMENT", "detail": "FREEMOBILE D1FD25 4269", "debit": 19.99, "credit": 0, "category": "Prélèvements"},
  {"date": "2025-11-05", "type": "PRELEVEMENT", "detail": "FREEMOBILE C3E6C7 1029", "debit": 2.99, "credit": 0, "category": "Prélèvements"},
  {"date": "2025-11-05", "type": "PRELEVEMENT", "detail": "DISNEYPLUS HELP DISNEY COM", "debit": 5.99, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-05", "type": "PAIEMENT PAR CARTE", "detail": "X6374 MP*CARREFOUR REIMS 03/11", "debit": 30.76, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-05", "type": "PAIEMENT PAR CARTE", "detail": "X6374 CARREFOUR REIMS CH 03/11", "debit": 17.23, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-05", "type": "PAIEMENT PAR CARTE", "detail": "X6374 Pathe Gaumont Tickets 04/11", "debit": 8.5, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-05", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 04/11", "debit": 6.7, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-04", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR INST de CAROLINE WIRTH", "debit": 0, "credit": 40, "category": "Virements reçus"},
  {"date": "2025-11-04", "type": "PAIEMENT PAR CARTE", "detail": "X6374 AMZ DIGITAL FRA PAYL 03/11", "debit": 4.49, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-04", "type": "PAIEMENT PAR CARTE", "detail": "X6374 EasyPark SARL easypa 03/11", "debit": 2.26, "credit": 0, "category": "Transport"},
  {"date": "2025-11-04", "type": "PRELEVEMENT", "detail": "PRELEVEMENT SMATIS FRANCE", "debit": 45.42, "credit": 0, "category": "Prélèvements"},
  {"date": "2025-11-03", "type": "VIREMENT EN VOTRE FAVEUR", "detail": "VIR INST de PACKOM SALAIRE", "debit": 0, "credit": 1750, "category": "Salaire"},
  {"date": "2025-11-03", "type": "VIREMENT EMIS", "detail": "VIR INST vers Mathilde Le Cerf", "debit": 65, "credit": 0, "category": "Virements émis"},
  {"date": "2025-11-03", "type": "PAIEMENT PAR CARTE", "detail": "X5239 TIMOTHEE ALIMENT REI 02/11", "debit": 4.45, "credit": 0, "category": "Alimentation & Courses"},
  {"date": "2025-11-03", "type": "PAIEMENT PAR CARTE", "detail": "X6374 Nintendo CD149419904 01/11", "debit": 3.99, "credit": 0, "category": "Loisirs"},
  {"date": "2025-11-03", "type": "PAIEMENT PAR CARTE", "detail": "X6374 EasyPark SARL easypa 31/10", "debit": 2.09, "credit": 0, "category": "Transport"}
];

// Constantes extraites hors du composant (pas de re-creation)
const COLORS = {
  'Alimentation & Courses': '#22c55e',
  'Restaurants': '#f97316',
  'Transport': '#3b82f6',
  'Loisirs': '#a855f7',
  'Shopping': '#ec4899',
  'Logement & Énergie': '#eab308',
  'Télécom': '#14b8a6',
  'Banque & Frais': '#6b7280',
  'Salaire': '#10b981',
  'Virements reçus': '#22d3ee',
  'Virements émis': '#f43f5e',
  'Remboursements': '#84cc16',
  'Prélèvements': '#8b5cf6',
  'Autres': '#94a3b8'
};

// Categories a exclure dans les calculs - Set pour O(1) lookup
const EXCLUDED_EXPENSE_CATEGORIES = new Set(['Virements émis', 'Salaire']);

// Formatter memorise au niveau module (singleton)
const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR'
});

const formatMoney = (amount) => currencyFormatter.format(amount);

// Formatter de date memorise
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
const formatDate = (dateStr) => dateFormatter.format(new Date(dateStr));

// Map des icones par categorie - defini une seule fois au niveau module
// Utilise les composants Lucide directement pour permettre le rendu dynamique
const CATEGORY_ICON_MAP = {
  'Alimentation & Courses': ShoppingCart,
  'Restaurants': Utensils,
  'Transport': Car,
  'Loisirs': Gamepad,
  'Shopping': CreditCard,
  'Logement & Énergie': Home,
  'Télécom': Smartphone,
  'Salaire': Wallet,
  'Virements reçus': ArrowDownCircle,
  'Virements émis': ArrowUpCircle,
};

// Composant icone memoize - ne re-render que si category ou color change
const CategoryIcon = memo(function CategoryIcon({ category, color }) {
  const IconComponent = CATEGORY_ICON_MAP[category] || CreditCard;
  return (
    <span style={{ color }}>
      <IconComponent className="w-4 h-4" />
    </span>
  );
});

// Configuration Tooltip memoises
const tooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px'
};

// Composant ligne de transaction memoize
const TransactionRow = memo(function TransactionRow({ transaction, color }) {
  const { date, detail, type, category, credit, debit } = transaction;
  const isCredit = credit > 0;

  return (
    <tr className="hover:bg-gray-700/30 transition-colors">
      <td className="py-3 text-sm text-gray-400">
        {formatDate(date)}
      </td>
      <td className="py-3">
        <p className="text-sm font-medium truncate max-w-[200px] md:max-w-none">{detail}</p>
        <p className="text-xs text-gray-500">{type}</p>
      </td>
      <td className="py-3">
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
          style={{
            backgroundColor: `${color}20`,
            color: color
          }}
        >
          {category}
        </span>
      </td>
      <td className={`py-3 text-right font-medium ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
        {isCredit ? '+' : '-'}{formatMoney(isCredit ? credit : debit)}
      </td>
    </tr>
  );
});

// Composant PieChart memoize pour eviter re-rendu inutile
const ExpensesPieChart = memo(function ExpensesPieChart({
  categoryData,
  selectedCategory,
  onCategoryClick
}) {
  const handleClick = useCallback((data) => {
    onCategoryClick(data.name);
  }, [onCategoryClick]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={categoryData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          onClick={handleClick}
        >
          {categoryData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              stroke={selectedCategory === entry.name ? '#fff' : 'transparent'}
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatMoney(value)}
          contentStyle={tooltipStyle}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

// Composant BarChart memoize
const DailyBarChart = memo(function DailyBarChart({ dailyData }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dailyData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          interval={2}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <Tooltip
          formatter={(value) => formatMoney(value)}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" radius={[4, 4, 0, 0]} />
        <Bar dataKey="revenus" fill="#22c55e" name="Revenus" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

// Composant bouton de filtre categorie memoize
const CategoryFilterButton = memo(function CategoryFilterButton({
  category,
  isSelected,
  onClick
}) {
  const handleClick = useCallback(() => {
    onClick(category.name);
  }, [onClick, category.name]);

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
        isSelected
          ? 'bg-white/20 ring-2 ring-white/40'
          : 'bg-gray-700 hover:bg-gray-600'
      }`}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </button>
  );
});

// Composant carte statistique memoize
const StatCard = memo(function StatCard({ icon: Icon, iconColor, label, value, valueColor }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <p className={`text-xl md:text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
});

export default function FinanceDashboard() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [viewMode, setViewMode] = useState('all');

  // Calcul optimise des statistiques - une seule iteration
  const stats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let realExpenses = 0;
    let realIncome = 0;

    for (const t of transactionsData) {
      totalDebit += t.debit;
      totalCredit += t.credit;

      // Depenses reelles (excluant virements emis et salaires internes)
      if (t.debit > 0 && !EXCLUDED_EXPENSE_CATEGORIES.has(t.category)) {
        realExpenses += t.debit;
      }

      // Revenus reels
      if (t.credit > 0 && t.category === 'Salaire') {
        realIncome += t.credit;
      }
    }

    return {
      totalDebit,
      totalCredit,
      balance: totalCredit - totalDebit,
      realExpenses,
      realIncome,
      soldeActuel: 243.62
    };
  }, []);

  // Donnees par categorie optimisees
  const categoryData = useMemo(() => {
    const categories = new Map();

    for (const t of transactionsData) {
      const existing = categories.get(t.category);
      if (existing) {
        existing.debit += t.debit;
        existing.credit += t.credit;
      } else {
        categories.set(t.category, {
          name: t.category,
          debit: t.debit,
          credit: t.credit
        });
      }
    }

    return Array.from(categories.values())
      .filter(c => c.debit > 0 && !EXCLUDED_EXPENSE_CATEGORIES.has(c.name))
      .sort((a, b) => b.debit - a.debit)
      .map(c => ({
        ...c,
        value: c.debit,
        color: COLORS[c.name] || COLORS['Autres']
      }));
  }, []);

  // Donnees journalieres optimisees
  const dailyData = useMemo(() => {
    const days = new Map();

    for (const t of transactionsData) {
      const existing = days.get(t.date);
      if (existing) {
        existing.depenses += t.debit;
        existing.revenus += t.credit;
      } else {
        days.set(t.date, {
          date: t.date,
          depenses: t.debit,
          revenus: t.credit
        });
      }
    }

    return Array.from(days.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        dateLabel: formatDate(d.date)
      }));
  }, []);

  // Transactions filtrees avec tri optimise
  const filteredTransactions = useMemo(() => {
    let filtered = transactionsData;

    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (viewMode === 'expenses') {
      filtered = filtered.filter(t => t.debit > 0);
    } else if (viewMode === 'income') {
      filtered = filtered.filter(t => t.credit > 0);
    }

    // Tri par date decroissante
    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCategory, viewMode]);

  // Handlers memoises
  const handleCategoryToggle = useCallback((categoryName) => {
    setSelectedCategory(prev => prev === categoryName ? null : categoryName);
  }, []);

  const handleClearCategory = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Tableau de Bord Finances</h1>
        <p className="text-gray-400">Novembre 2025 - Compte n. 53981220362</p>
      </div>

      {/* Cards statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          icon={Wallet}
          iconColor="text-blue-400"
          label="Solde actuel"
          value={formatMoney(stats.soldeActuel)}
          valueColor="text-blue-400"
        />
        <StatCard
          icon={TrendingUp}
          iconColor="text-green-400"
          label="Revenus"
          value={`+${formatMoney(stats.realIncome)}`}
          valueColor="text-green-400"
        />
        <StatCard
          icon={TrendingDown}
          iconColor="text-red-400"
          label="Depenses"
          value={`-${formatMoney(stats.realExpenses)}`}
          valueColor="text-red-400"
        />
        <StatCard
          icon={PiggyBank}
          iconColor="text-purple-400"
          label="Bilan du mois"
          value={formatMoney(stats.balance)}
          valueColor={stats.balance >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Graphiques */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-6">
        {/* Camembert des depenses */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-purple-400" />
            Repartition des depenses
          </h2>
          <div className="h-64">
            <ExpensesPieChart
              categoryData={categoryData}
              selectedCategory={selectedCategory}
              onCategoryClick={handleCategoryToggle}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {categoryData.slice(0, 6).map((cat) => (
              <CategoryFilterButton
                key={cat.name}
                category={cat}
                isSelected={selectedCategory === cat.name}
                onClick={handleCategoryToggle}
              />
            ))}
          </div>
        </div>

        {/* Evolution temporelle */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Evolution du mois
          </h2>
          <div className="h-64">
            <DailyBarChart dailyData={dailyData} />
          </div>
        </div>
      </div>

      {/* Top categories */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold mb-4">Top depenses par categorie</h2>
        <div className="space-y-3">
          {categoryData.slice(0, 5).map((cat) => (
            <div key={cat.name} className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <CategoryIcon category={cat.name} color={cat.color} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-sm text-gray-400">{formatMoney(cat.debit)}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(cat.debit / categoryData[0].debit) * 100}%`,
                      backgroundColor: cat.color
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liste des transactions */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            Transactions
            {selectedCategory && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                Filtre: {selectedCategory}
                <button
                  onClick={handleClearCategory}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  x
                </button>
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            {['all', 'expenses', 'income'].map((mode) => (
              <button
                key={mode}
                onClick={() => handleViewModeChange(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {mode === 'all' ? 'Tout' : mode === 'expenses' ? 'Depenses' : 'Revenus'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="text-left text-gray-400 text-sm border-b border-gray-700 sticky top-0 bg-gray-800">
              <tr>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Categorie</th>
                <th className="pb-3 font-medium text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredTransactions.map((t, i) => (
                <TransactionRow
                  key={`${t.date}-${t.detail}-${i}`}
                  transaction={t}
                  color={COLORS[t.category] || COLORS['Autres']}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-gray-500 text-sm mt-4">
          {filteredTransactions.length} transaction(s) affichee(s)
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-gray-600 text-xs mt-6">
        Donnees du 01/11/2025 au 30/11/2025 - M. ou Mme WIRTH MARVIN LE CERF CAROLINE
      </p>
    </div>
  );
}
