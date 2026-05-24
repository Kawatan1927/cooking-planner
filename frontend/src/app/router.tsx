import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Placeholder } from '../components/Placeholder';
import { CallbackPage, LoginPage, ProtectedRoute } from '../features/auth';
import { MenusPage } from '../features/menus';
import { RecipeDetailPage, RecipeListPage, RecipeNewPage } from '../features/recipes';

export const router = createBrowserRouter([
  // 認証系：AppLayout の外（ヘッダー無し）
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/callback',
    element: <CallbackPage />,
  },
  // 主要ページ：AppLayout 配下（ヘッダー共通）
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
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
            element: <RecipeDetailPage />,
          },
          {
            path: '/menus',
            element: <MenusPage />,
          },
          {
            path: '/shopping-list',
            element: <Placeholder title="買い物リスト" />,
          },
        ],
      },
    ],
  },
]);
