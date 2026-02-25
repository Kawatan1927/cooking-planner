import { createBrowserRouter } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder';
import { RecipeListPage, RecipeNewPage } from '../features/recipes';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Placeholder title="Login" />,
  },
  {
    path: '/',
    element: <Placeholder title="Dashboard" />,
  },
  {
    path: '/recipes',
    element: <RecipeListPage />,
  },
  {
    path: '/recipes/new',
    element: <RecipeNewPage />,
  },
  {
    path: '/recipes/:id',
    element: <Placeholder title="レシピ詳細" />,
  },
  {
    path: '/menus',
    element: <Placeholder title="献立一覧" />,
  },
  {
    path: '/shopping-list',
    element: <Placeholder title="買い物リスト" />,
  },
]);
