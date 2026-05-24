import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { CallbackPage, LoginPage, ProtectedRoute } from '../features/auth';
import { DashboardPage } from '../features/dashboard';
import { MenusPage } from '../features/menus';
import { RecipeDetailPage, RecipeListPage, RecipeNewPage } from '../features/recipes';
import { ShoppingListPage } from '../features/shoppingList';

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
            element: <DashboardPage />,
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
            element: <ShoppingListPage />,
          },
        ],
      },
    ],
  },
]);
