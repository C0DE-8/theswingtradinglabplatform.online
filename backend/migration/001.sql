-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 23, 2026 at 08:56 PM
-- Server version: 11.4.12-MariaDB-cll-lve-log
-- PHP Version: 8.4.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `njucitgh_74globalgain-pw`
--

-- --------------------------------------------------------

--
-- Table structure for table `balance_conversions`
--

CREATE TABLE `balance_conversions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `from_balance` enum('holding') NOT NULL DEFAULT 'holding',
  `to_balance` enum('trading','staking') NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `balance_conversions`
--

INSERT INTO `balance_conversions` (`id`, `user_id`, `from_balance`, `to_balance`, `amount`, `currency`, `created_at`) VALUES
(1, 2, 'holding', 'staking', 100.00, 'USD', '2025-08-22 12:15:03'),
(2, 3, 'holding', 'trading', 2000.00, 'USD', '2025-08-25 16:44:54'),
(3, 3, 'holding', 'trading', 1050.00, 'USD', '2025-08-25 16:57:09');

-- --------------------------------------------------------

--
-- Table structure for table `blocked_actions`
--

CREATE TABLE `blocked_actions` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `action` varchar(64) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `copy_trades`
--

CREATE TABLE `copy_trades` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `followers` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `avg_return` decimal(6,2) NOT NULL DEFAULT 0.00,
  `profit_share` decimal(5,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `copy_trades`
--

INSERT INTO `copy_trades` (`id`, `name`, `image_url`, `followers`, `avg_return`, `profit_share`, `created_at`, `updated_at`) VALUES
(1, 'Trader Alpha', '/uploads/copy_trades/1755801331230-960px-Theo_Von_Edited_James_Tamim-1-945x1024.jpg', 1199, 18.75, 20.00, '2025-08-21 18:07:17', '2025-08-21 19:32:03'),
(2, 'Light', '/uploads/copy_trades/1755800894551-960px-Theo_Von_Edited_James_Tamim-1-945x1024.jpg', 2301, 18.70, 20.00, '2025-08-21 18:28:14', '2025-09-01 13:36:23'),
(3, 'Michael Saylor', '/uploads/copy_trades/1756738917402-8t0DGo6V_400x400_(3).jpg', 11087, 98.47, 10.00, '2025-09-01 15:01:57', '2025-09-01 16:34:30');

-- --------------------------------------------------------

--
-- Table structure for table `deposit_wallets`
--

CREATE TABLE `deposit_wallets` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `currency` varchar(20) NOT NULL,
  `network` varchar(20) DEFAULT NULL,
  `address` varchar(128) NOT NULL,
  `qr_code` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `deposit_wallets`
--

INSERT INTO `deposit_wallets` (`id`, `currency`, `network`, `address`, `qr_code`, `is_active`, `created_at`, `updated_at`) VALUES
(3, 'SOLANA', 'SOL', 'Bfj6L8vZH8xjaAzrg41KQtSJrd4v7ipVjXfgRnGg2R2d', 'uploads/deposit_wallets/1756504594719-project.webp', 1, '2025-08-29 21:50:41', '2025-08-29 21:56:34'),
(4, 'XRP', 'XRP', 'rp1NkRNnn7fdFHobEQ97N5nTomf2vDs78c', 'uploads/deposit_wallets/1756506307692-project.webp', 1, '2025-08-29 22:25:06', '2025-08-29 22:26:11'),
(12, 'ETH', 'ETH', '0x1db1230566110e3A5E68f95a15DBAA3AF44a0aD9', 'uploads/deposit_wallets/1756506760101-project.webp', 1, '2025-08-29 22:32:40', '2025-08-29 22:32:40'),
(13, 'SUI', 'SUI', '0xb763dfb902e915d0d909edd70554d98f2e3f081d9f8ca22c75e9258afe60a75c', 'uploads/deposit_wallets/1756507144339-project.webp', 1, '2025-08-29 22:39:04', '2025-08-29 22:39:04'),
(14, 'DOGE COIN', 'DOGE COIN', 'D5m9DbWEkh1F5yeqbfQRF5ABKcJxNpYC9G', 'uploads/deposit_wallets/1756507674718-pr.jpg', 1, '2025-08-29 22:47:52', '2025-08-29 22:47:54'),
(17, 'BTC', 'BTC', 'bc1q82swpj9j7xw4m3pcfj8uhvnf082yavy745ty3z', 'uploads/deposit_wallets/1756507950444-pr.webp', 1, '2025-08-29 22:52:29', '2025-08-29 22:52:30'),
(21, 'USDT', 'ERC20', '0x1db1230566110e3A5E68f95a15DBAA3AF44a0aD9', 'uploads/deposit_wallets/1756508445189-project.webp', 1, '2025-08-29 22:55:42', '2025-08-29 23:00:45');

-- --------------------------------------------------------

--
-- Table structure for table `login_otps`
--

CREATE TABLE `login_otps` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `otp` varchar(10) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `login_otps`
--

INSERT INTO `login_otps` (`id`, `user_id`, `otp`, `created_at`) VALUES
(1, 2, '392054', '2025-08-21 17:19:41'),
(2, 3, '396214', '2025-08-23 09:24:27'),
(3, 3, '366033', '2025-08-23 09:34:15'),
(4, 4, '613955', '2025-08-23 14:12:27'),
(5, 4, '995962', '2025-08-23 14:22:35'),
(15, 6, '554171', '2026-02-01 20:55:20'),
(16, 6, '865969', '2026-02-01 20:57:06');

-- --------------------------------------------------------

--
-- Table structure for table `otp_bypass`
--

CREATE TABLE `otp_bypass` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `otp_bypass`
--

INSERT INTO `otp_bypass` (`user_id`, `created_at`) VALUES
(2, '2025-08-21 17:26:24'),
(3, '2025-08-25 16:30:42');

-- --------------------------------------------------------

--
-- Table structure for table `simple_trades`
--

CREATE TABLE `simple_trades` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `trade_type` enum('etf','index','forex','stock','crypto') NOT NULL,
  `symbol` varchar(32) NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `leverage` int(11) NOT NULL DEFAULT 1,
  `timeframe` varchar(16) NOT NULL,
  `direction` enum('up','down') NOT NULL,
  `status` enum('open','closed','cancelled') NOT NULL DEFAULT 'open',
  `opened_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `closed_at` timestamp NULL DEFAULT NULL,
  `created_by_admin` tinyint(1) NOT NULL DEFAULT 1,
  `pnl_amount` decimal(18,2) NOT NULL DEFAULT 0.00,
  `balance_type` enum('trading','staking') NOT NULL DEFAULT 'trading'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `simple_trades`
--

INSERT INTO `simple_trades` (`id`, `user_id`, `trade_type`, `symbol`, `amount`, `leverage`, `timeframe`, `direction`, `status`, `opened_at`, `closed_at`, `created_by_admin`, `pnl_amount`, `balance_type`) VALUES
(1, 2, 'crypto', 'BTCUSD', 1000.00, 10, '1h', 'up', 'closed', '2025-08-22 08:29:13', '2025-08-22 08:36:04', 1, 75.50, 'trading'),
(2, 2, 'crypto', 'BTCUSD', 100.00, 10, '1h', 'up', 'closed', '2025-08-22 08:41:08', '2025-08-22 08:48:12', 1, 0.00, 'trading'),
(3, 2, 'crypto', 'BTCUSD', 100.00, 10, '1h', 'up', 'closed', '2025-08-22 08:41:27', '2025-08-22 08:51:05', 1, 2351.00, 'trading'),
(4, 2, 'crypto', 'BTCUSD', 500.00, 5, '1h', 'up', 'open', '2025-08-22 08:41:57', NULL, 1, 0.00, 'trading'),
(5, 3, 'stock', 'Tesla stock ', 300.00, 5, '5m', 'up', 'closed', '2025-08-25 16:47:49', '2025-08-25 16:53:15', 1, 50.00, 'trading'),
(6, 3, 'crypto', 'BTCUSD', 100.00, 1, '5m', 'up', 'closed', '2025-08-25 16:52:02', '2025-08-25 16:54:05', 1, 1050.00, 'trading'),
(7, 3, 'crypto', 'SOLANA', 500.00, 2, '5', 'up', 'closed', '2025-08-29 23:04:25', '2025-08-29 23:11:06', 1, 700.00, 'trading'),
(8, 3, 'stock', 'TESLA', 1950.00, 3, '1', 'up', 'closed', '2025-08-29 23:17:34', '2025-08-29 23:20:48', 1, 0.00, 'trading'),
(9, 3, 'stock', 'TESLA', 1950.00, 2, '5', 'up', 'closed', '2025-08-29 23:24:10', '2025-09-01 13:50:39', 1, 500.00, 'trading'),
(10, 3, 'stock', 'TESLA STOCK', 700.00, 20, '5', 'up', 'open', '2025-09-01 14:35:30', NULL, 1, 0.00, 'trading'),
(11, 3, 'crypto', 'btcusd', 50.00, 1, '5', 'up', 'open', '2025-09-01 15:09:47', NULL, 1, 100.00, 'trading'),
(12, 3, 'stock', 'Apple Stock', 150.00, 2, '5', 'up', 'closed', '2025-09-01 15:14:49', '2025-09-01 15:28:22', 1, 100.00, 'trading'),
(13, 3, 'crypto', 'SOLusd', 200.00, 1, '5', 'up', 'closed', '2025-09-01 15:21:00', '2025-09-01 15:22:48', 1, 150.00, 'trading'),
(14, 3, 'index', '150', 100.00, 1, '10', 'up', 'closed', '2025-09-01 15:32:55', '2025-09-01 15:35:28', 1, 150.00, 'trading'),
(15, 3, 'stock', 'TESLA STOCK', 150.00, 1, '5', 'up', 'closed', '2025-09-01 15:37:43', '2025-09-01 15:38:13', 1, 200.00, 'trading');

-- --------------------------------------------------------

--
-- Table structure for table `trading_plans`
--

CREATE TABLE `trading_plans` (
  `id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text DEFAULT NULL,
  `min_amount` decimal(18,2) NOT NULL,
  `max_amount` decimal(18,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `trading_plans`
--

INSERT INTO `trading_plans` (`id`, `name`, `description`, `min_amount`, `max_amount`, `created_at`, `updated_at`) VALUES
(1, 'starter', 'Entry plan for new traders', 100.00, 1000.00, '2025-09-01 15:20:54', '2025-09-01 15:20:54');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `profile_id` varchar(64) NOT NULL,
  `trading_balance` decimal(24,2) NOT NULL DEFAULT 0.00,
  `holding_balance` decimal(24,2) NOT NULL DEFAULT 0.00,
  `staking_balance` decimal(24,2) NOT NULL DEFAULT 0.00,
  `name` varchar(120) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(50) NOT NULL,
  `phone_number` varchar(32) NOT NULL,
  `address` varchar(255) NOT NULL,
  `occupation` varchar(100) NOT NULL,
  `date_of_birth` date NOT NULL,
  `nationality` varchar(64) NOT NULL,
  `account_type` varchar(32) NOT NULL,
  `base_currency` varchar(16) NOT NULL,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `isAdmin` tinyint(1) NOT NULL DEFAULT 0,
  `otp` varchar(10) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `signal_strength` decimal(5,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `profile_id`, `trading_balance`, `holding_balance`, `staking_balance`, `name`, `email`, `password`, `username`, `phone_number`, `address`, `occupation`, `date_of_birth`, `nationality`, `account_type`, `base_currency`, `is_verified`, `isAdmin`, `otp`, `created_at`, `updated_at`, `signal_strength`) VALUES
(1, 'adm-0000000000000', 0.00, 0.00, 0.00, 'Admin User', 'Admin@74globalgain.pw', '123456', 'admin', '0000000000', 'HQ', 'Administrator', '1990-01-01', 'NG', 'Current', 'USD', 1, 1, NULL, '2025-08-21 15:46:14', '2025-12-17 20:41:58', 0.00),
(2, 'sta-1755794427659', 1680.00, 125.55, 1700.00, 'sam', '8amlight@gmail.com', '123456', 'sam', '+2348012345678', '12 Marina Rd, Lagos', 'Developer', '1995-06-15', 'NG', 'Current', 'USD', 1, 0, NULL, '2025-08-21 16:40:27', '2025-12-15 15:58:48', 21.00),
(3, 'Lin-1755941029813', 0.00, 750.00, 0.00, 'Lindacarson', 'lindacarson401@gmail.com', 'ufuomaog', 'Linda74', '+234 712 463 9201', 'Lagos ', 'Engineer ', '2001-08-23', 'OTHER', 'business', 'USD', 1, 0, NULL, '2025-08-23 09:23:49', '2025-09-04 19:55:08', 56.00),
(4, 'hab-1755958267221', 50.00, 7500.00, 300.00, 'sam light habibi', 'oghenesupersam914@gmail.com', '123456', 'habibi', '+2349078531157', 'No 7 Jesus Is Lord Ojipata Layout', 'fisher man', '2000-01-26', 'CA', 'business', 'USD', 1, 0, NULL, '2025-08-23 14:11:07', '2026-01-09 20:47:55', 21.00),
(5, 'dho-1757072731608', 0.00, 0.00, 0.00, 'John Smith', 'gubyliwu@cyclelove.cc', 'John@12345&', 'dhoni26', '+919876788760', '1213 road india', 'wewewew', '1987-09-09', 'US', 'individual', 'USD', 1, 0, NULL, '2025-09-05 11:45:31', '2025-09-05 11:46:56', 0.00),
(6, 'Emm-1769979282681', 0.00, 0.00, 0.00, 'Idols Friday Emmanuel', 'danty5769@gmail.com', 'EKUM2006', 'Emmy', '09041416236', 'Texas ', 'Farmee', '2026-02-01', 'OTHER', 'individual', 'USD', 1, 0, NULL, '2026-02-01 20:54:42', '2026-02-01 20:55:11', 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `user_activity`
--

CREATE TABLE `user_activity` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `action` varchar(64) NOT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_activity`
--

INSERT INTO `user_activity` (`id`, `user_id`, `action`, `details`, `created_at`) VALUES
(1, 2, 'verify', 'Account verified via signup OTP', '2025-08-21 16:44:12'),
(2, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-21 17:00:59'),
(3, 2, 'login', 'Login confirmed with OTP', '2025-08-21 17:22:10'),
(4, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-21 17:27:00'),
(5, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-22 08:26:16'),
(6, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 08:59:54'),
(7, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-22 11:04:31'),
(8, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 11:05:23'),
(9, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 11:09:12'),
(10, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 11:14:16'),
(11, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 11:14:54'),
(12, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 11:15:21'),
(13, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 11:18:26'),
(14, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-22 11:20:29'),
(15, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-23 08:17:16'),
(16, 3, 'verify', 'Account verified via signup OTP', '2025-08-23 09:24:18'),
(17, 4, 'verify', 'Account verified via signup OTP', '2025-08-23 14:11:30'),
(18, 4, 'login', 'Login confirmed with OTP', '2025-08-23 14:27:02'),
(19, 3, 'login', 'Login confirmed with OTP', '2025-08-23 19:22:02'),
(20, 3, 'login', 'Login confirmed with OTP', '2025-08-24 02:59:25'),
(21, 4, 'login', 'Login confirmed with OTP', '2025-08-24 15:47:20'),
(22, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-24 16:50:02'),
(23, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-24 17:00:46'),
(24, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-24 17:13:20'),
(25, 3, 'login', 'Login confirmed with OTP', '2025-08-25 07:47:37'),
(26, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-25 07:51:48'),
(27, 4, 'login', 'Login confirmed with OTP', '2025-08-25 07:58:21'),
(28, 4, 'login', 'Login confirmed with OTP', '2025-08-25 08:07:45'),
(29, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-25 08:25:31'),
(30, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-25 16:11:24'),
(31, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-25 16:12:04'),
(32, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-25 16:13:32'),
(33, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-25 16:27:36'),
(34, 3, 'login', 'Login confirmed with OTP', '2025-08-25 16:29:02'),
(35, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-29 17:55:03'),
(36, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-29 20:39:38'),
(37, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-08-29 21:45:11'),
(38, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-29 23:07:54'),
(39, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-08-30 08:14:48'),
(40, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 13:34:47'),
(41, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 13:35:13'),
(42, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 13:37:06'),
(43, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 13:43:13'),
(44, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 13:43:23'),
(45, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 13:50:48'),
(46, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 13:57:02'),
(47, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:00:18'),
(48, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:08:33'),
(49, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:14:52'),
(50, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:16:24'),
(51, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:21:35'),
(52, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:23:19'),
(53, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:23:19'),
(54, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:24:12'),
(55, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:24:48'),
(56, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:24:48'),
(57, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:26:42'),
(58, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:33:56'),
(59, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:39:24'),
(60, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:42:44'),
(61, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:44:03'),
(62, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:45:50'),
(63, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:47:25'),
(64, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:51:38'),
(65, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:53:09'),
(66, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:54:49'),
(67, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 14:57:48'),
(68, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 14:59:31'),
(69, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:08:58'),
(70, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:10:13'),
(71, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:13:58'),
(72, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:15:04'),
(73, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:16:27'),
(74, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:16:29'),
(75, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:16:36'),
(76, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:16:37'),
(77, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:17:13'),
(78, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:17:14'),
(79, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:19:09'),
(80, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:20:22'),
(81, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:23:00'),
(82, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:26:00'),
(83, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:26:59'),
(84, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:27:41'),
(85, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:28:00'),
(86, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:30:14'),
(87, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:30:46'),
(88, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:30:47'),
(89, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:30:51'),
(90, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:31:29'),
(91, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:31:44'),
(92, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:33:54'),
(93, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:34:48'),
(94, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:34:48'),
(95, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:37:02'),
(96, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:38:28'),
(97, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:41:54'),
(98, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:42:56'),
(99, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:44:51'),
(100, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:47:56'),
(101, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:48:03'),
(102, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:48:39'),
(103, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:52:51'),
(104, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:53:15'),
(105, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:53:40'),
(106, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:58:22'),
(107, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:58:23'),
(108, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 15:58:29'),
(109, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 15:59:15'),
(110, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 16:06:27'),
(111, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 16:08:11'),
(112, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 16:10:14'),
(113, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 16:11:10'),
(114, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 16:11:42'),
(115, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 16:12:25'),
(116, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 16:15:00'),
(117, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 16:34:08'),
(118, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-01 16:57:10'),
(119, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-01 16:58:12'),
(120, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-02 10:40:26'),
(121, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-02 10:41:04'),
(122, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-02 10:45:09'),
(123, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-02 10:46:02'),
(124, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-04 19:52:58'),
(125, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-04 19:54:18'),
(126, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-09-04 20:07:02'),
(127, 3, 'login-bypass', 'Login OTP bypassed by admin', '2025-09-04 20:09:27'),
(128, 5, 'verify', 'Account verified via signup OTP', '2025-09-05 11:46:56'),
(129, 5, 'login', 'Login confirmed with OTP', '2025-09-05 11:47:26'),
(130, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-12-15 15:51:31'),
(131, 2, 'login-bypass', 'Login OTP bypassed by admin', '2025-12-15 15:57:28'),
(132, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-12-17 20:42:26'),
(133, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-12-17 20:43:33'),
(134, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-12-18 01:01:15'),
(135, 1, 'admin-login', 'Admin logged in directly without OTP', '2025-12-21 00:04:58'),
(136, 1, 'admin-login', 'Admin logged in directly without OTP', '2026-01-09 20:44:33'),
(137, 6, 'verify', 'Account verified via signup OTP', '2026-02-01 20:55:11');

-- --------------------------------------------------------

--
-- Table structure for table `user_copy_trades`
--

CREATE TABLE `user_copy_trades` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `copy_trade_id` int(10) UNSIGNED NOT NULL,
  `status` enum('profit','loss','neutral') DEFAULT 'neutral',
  `pnl_amount` decimal(24,2) NOT NULL DEFAULT 0.00,
  `pnl_percent` decimal(6,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `invested_amount` decimal(24,2) NOT NULL DEFAULT 0.00,
  `funding_source` enum('trading','staking') DEFAULT 'trading',
  `trade_type` varchar(10) DEFAULT NULL CHECK (`trade_type` in ('crypto','forex') or `trade_type` is null),
  `symbol` varchar(32) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_copy_trades`
--

INSERT INTO `user_copy_trades` (`id`, `user_id`, `copy_trade_id`, `status`, `pnl_amount`, `pnl_percent`, `created_at`, `updated_at`, `invested_amount`, `funding_source`, `trade_type`, `symbol`) VALUES
(7, 3, 2, 'loss', -200.00, -1.00, '2025-09-01 13:36:23', '2025-09-01 14:56:17', 5850.00, 'trading', NULL, NULL),
(13, 3, 3, 'profit', 350.00, 1.00, '2025-09-01 16:04:15', '2025-09-04 19:55:08', 2000.00, 'trading', NULL, NULL),
(14, 2, 3, 'loss', -199.00, -2.00, '2025-09-01 16:34:30', '2025-09-01 16:57:59', 200.00, 'trading', 'crypto', 'BTCUSD');

-- --------------------------------------------------------

--
-- Table structure for table `user_deposits`
--

CREATE TABLE `user_deposits` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `balance_type` enum('trading','staking') NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `currency` varchar(10) DEFAULT 'USD',
  `proof_path` varchar(255) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `note` varchar(255) DEFAULT NULL,
  `reviewed_by` int(10) UNSIGNED DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_deposits`
--

INSERT INTO `user_deposits` (`id`, `user_id`, `balance_type`, `amount`, `currency`, `proof_path`, `status`, `note`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`) VALUES
(1, 2, 'staking', 700.00, 'USD', 'uploads/deposits/1755855981878-GP.jpg', 'approved', 'Payment confirmed on ledger', 1, '2025-08-22 09:49:32', '2025-08-22 09:46:21', '2025-08-22 09:49:32'),
(2, 3, 'trading', 1000.00, 'BTC', 'uploads/deposits/1756139659907-20250824_045546.jpg', 'approved', 'Done', 1, '2025-08-25 16:35:19', '2025-08-25 16:34:19', '2025-08-25 16:35:19'),
(3, 1, 'trading', 2000.00, 'BTC', 'uploads/deposits/1756735422807-Screenshot_20250901-135528_WhatsAppBusiness.jpg', 'pending', 'Trading', NULL, NULL, '2025-09-01 14:03:42', '2025-09-01 14:03:42'),
(4, 3, 'trading', 2000.00, 'ETH', 'uploads/deposits/1756735858153-Screenshot_20250901-135528_WhatsAppBusiness.jpg', 'approved', 'Confirmed', 1, '2025-09-01 14:15:50', '2025-09-01 14:10:58', '2025-09-01 14:15:50'),
(5, 3, 'trading', 2000.00, 'ETH', 'uploads/deposits/1756735932778-Screenshot_20250901-135528_WhatsAppBusiness.jpg', 'approved', NULL, 1, '2025-09-01 14:26:05', '2025-09-01 14:12:12', '2025-09-01 14:26:05'),
(6, 3, 'trading', 2000.00, 'ETH', 'uploads/deposits/1756735986512-20250901_133238.jpg', 'pending', 'Tradig', NULL, NULL, '2025-09-01 14:13:06', '2025-09-01 14:13:06'),
(7, 3, 'trading', 1000.00, 'BTC', 'uploads/deposits/1756742263442-8t0DGo6V_400x400_(3).jpg', 'approved', NULL, 1, '2025-09-01 15:59:01', '2025-09-01 15:57:43', '2025-09-01 15:59:01'),
(8, 3, 'trading', 1000.00, 'ETH', 'uploads/deposits/1756809878746-20250902_102806.jpg', 'approved', NULL, 1, '2025-09-02 10:45:48', '2025-09-02 10:44:38', '2025-09-02 10:45:48');

-- --------------------------------------------------------

--
-- Table structure for table `user_withdrawals`
--

CREATE TABLE `user_withdrawals` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `balance_type` enum('trading','staking') NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `address` varchar(255) NOT NULL,
  `network` varchar(20) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `note` varchar(255) DEFAULT NULL,
  `tx_hash` varchar(128) DEFAULT NULL,
  `reviewed_by` int(10) UNSIGNED DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_withdrawals`
--

INSERT INTO `user_withdrawals` (`id`, `user_id`, `balance_type`, `amount`, `currency`, `address`, `network`, `status`, `note`, `tx_hash`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`) VALUES
(1, 2, 'trading', 120.00, 'USD', 'TXYZ1234....', 'TRC20', 'approved', 'Sent', '0xabc123...', 1, '2025-08-22 10:08:49', '2025-08-22 10:06:50', '2025-08-22 10:08:49'),
(2, 2, 'trading', 120.00, 'USD', 'TXYZ1234....', 'TRC20', 'rejected', 'Address mismatch', NULL, 1, '2025-08-22 10:09:03', '2025-08-22 10:07:21', '2025-08-22 10:09:03'),
(3, 3, 'staking', 500.00, 'USD', 'Btcwu2iU1DdZbK ', 'Btx', 'approved', 'Good ', NULL, 1, '2025-08-25 17:00:19', '2025-08-25 16:58:09', '2025-08-25 17:00:19'),
(4, 2, 'trading', 500.00, 'USD', 'bc1qgkldlrzrrfer8nu4xyr85fgqn8atwgrjzctnt9', 'BTC', 'pending', NULL, NULL, NULL, NULL, '2025-12-15 15:58:48', '2025-12-15 15:58:48');

-- --------------------------------------------------------

--
-- Table structure for table `wallets`
--

CREATE TABLE `wallets` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `currency` varchar(32) NOT NULL,
  `balance` decimal(24,8) NOT NULL DEFAULT 0.00000000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `wallets`
--

INSERT INTO `wallets` (`id`, `user_id`, `currency`, `balance`, `created_at`, `updated_at`) VALUES
(1, 1, 'USD', 0.00000000, '2025-08-21 15:46:14', '2025-08-21 15:46:14'),
(2, 2, 'BTC', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(3, 2, 'USDC', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(4, 2, 'Litecoin', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(5, 2, 'BNB', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(6, 2, 'BCH', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(7, 2, 'USDT-ERC20', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(8, 2, 'SOL', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(9, 2, 'USDT-TRC20', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(10, 2, 'ETH', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(11, 2, 'USD', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(12, 2, 'XRP', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(13, 2, 'TRX', 0.00000000, '2025-08-21 16:40:27', '2025-08-21 16:40:27'),
(14, 3, 'BTC', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(15, 3, 'USDC', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(16, 3, 'BCH', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(17, 3, 'ETH', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(18, 3, 'USDT-TRC20', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(19, 3, 'USDT-ERC20', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(20, 3, 'XRP', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(21, 3, 'Litecoin', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(22, 3, 'USD', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(23, 3, 'SOL', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(24, 3, 'TRX', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(25, 3, 'BNB', 0.00000000, '2025-08-23 09:23:49', '2025-08-23 09:23:49'),
(26, 4, 'BTC', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(27, 4, 'USDC', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(28, 4, 'BCH', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(29, 4, 'ETH', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(30, 4, 'USDT-TRC20', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(31, 4, 'USDT-ERC20', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(32, 4, 'TRX', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(33, 4, 'XRP', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(34, 4, 'SOL', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(35, 4, 'BNB', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(36, 4, 'Litecoin', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(37, 4, 'USD', 0.00000000, '2025-08-23 14:11:07', '2025-08-23 14:11:07'),
(38, 5, 'BTC', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(39, 5, 'USDC', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(40, 5, 'ETH', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(41, 5, 'USDT-TRC20', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(42, 5, 'XRP', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(43, 5, 'USDT-ERC20', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(44, 5, 'Litecoin', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(45, 5, 'SOL', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(46, 5, 'USD', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(47, 5, 'TRX', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(48, 5, 'BCH', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(49, 5, 'BNB', 0.00000000, '2025-09-05 11:45:31', '2025-09-05 11:45:31'),
(50, 6, 'BTC', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(51, 6, 'USDC', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(52, 6, 'ETH', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(53, 6, 'USDT-TRC20', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(54, 6, 'XRP', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(55, 6, 'USDT-ERC20', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(56, 6, 'Litecoin', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(57, 6, 'USD', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(58, 6, 'SOL', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(59, 6, 'BNB', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(60, 6, 'TRX', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42'),
(61, 6, 'BCH', 0.00000000, '2026-02-01 20:54:42', '2026-02-01 20:54:42');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `balance_conversions`
--
ALTER TABLE `balance_conversions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_time` (`user_id`,`created_at`);

--
-- Indexes for table `blocked_actions`
--
ALTER TABLE `blocked_actions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_blocked_user_action` (`user_id`,`action`),
  ADD KEY `idx_blocked_actions_user` (`user_id`);

--
-- Indexes for table `copy_trades`
--
ALTER TABLE `copy_trades`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_copy_trades_name` (`name`);

--
-- Indexes for table `deposit_wallets`
--
ALTER TABLE `deposit_wallets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_currency_network` (`currency`,`network`);

--
-- Indexes for table `login_otps`
--
ALTER TABLE `login_otps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_login_otps_user_time` (`user_id`,`created_at`);

--
-- Indexes for table `otp_bypass`
--
ALTER TABLE `otp_bypass`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `simple_trades`
--
ALTER TABLE `simple_trades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_simple_trades_user` (`user_id`);

--
-- Indexes for table `trading_plans`
--
ALTER TABLE `trading_plans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_trading_plans_name` (`name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD UNIQUE KEY `uq_users_username` (`username`),
  ADD UNIQUE KEY `uq_users_profile_id` (`profile_id`);

--
-- Indexes for table `user_activity`
--
ALTER TABLE `user_activity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_activity_user_time` (`user_id`,`created_at`);

--
-- Indexes for table `user_copy_trades`
--
ALTER TABLE `user_copy_trades`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_copy` (`user_id`,`copy_trade_id`),
  ADD KEY `fk_uct_copy` (`copy_trade_id`),
  ADD KEY `idx_uct_trade_type` (`trade_type`),
  ADD KEY `idx_uct_symbol` (`symbol`);

--
-- Indexes for table `user_deposits`
--
ALTER TABLE `user_deposits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_status` (`user_id`,`status`);

--
-- Indexes for table `user_withdrawals`
--
ALTER TABLE `user_withdrawals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_status` (`user_id`,`status`);

--
-- Indexes for table `wallets`
--
ALTER TABLE `wallets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wallets_user` (`user_id`),
  ADD KEY `idx_wallets_user_currency` (`user_id`,`currency`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `balance_conversions`
--
ALTER TABLE `balance_conversions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `blocked_actions`
--
ALTER TABLE `blocked_actions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `copy_trades`
--
ALTER TABLE `copy_trades`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `deposit_wallets`
--
ALTER TABLE `deposit_wallets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `login_otps`
--
ALTER TABLE `login_otps`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `simple_trades`
--
ALTER TABLE `simple_trades`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `trading_plans`
--
ALTER TABLE `trading_plans`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `user_activity`
--
ALTER TABLE `user_activity`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=138;

--
-- AUTO_INCREMENT for table `user_copy_trades`
--
ALTER TABLE `user_copy_trades`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `user_deposits`
--
ALTER TABLE `user_deposits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `user_withdrawals`
--
ALTER TABLE `user_withdrawals`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `wallets`
--
ALTER TABLE `wallets`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `balance_conversions`
--
ALTER TABLE `balance_conversions`
  ADD CONSTRAINT `fk_balance_conversions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `blocked_actions`
--
ALTER TABLE `blocked_actions`
  ADD CONSTRAINT `fk_blocked_actions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `login_otps`
--
ALTER TABLE `login_otps`
  ADD CONSTRAINT `fk_login_otps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `otp_bypass`
--
ALTER TABLE `otp_bypass`
  ADD CONSTRAINT `fk_otp_bypass_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `simple_trades`
--
ALTER TABLE `simple_trades`
  ADD CONSTRAINT `fk_simple_trades_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_activity`
--
ALTER TABLE `user_activity`
  ADD CONSTRAINT `fk_user_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_copy_trades`
--
ALTER TABLE `user_copy_trades`
  ADD CONSTRAINT `fk_uct_copy` FOREIGN KEY (`copy_trade_id`) REFERENCES `copy_trades` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_uct_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_deposits`
--
ALTER TABLE `user_deposits`
  ADD CONSTRAINT `fk_user_deposits_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_withdrawals`
--
ALTER TABLE `user_withdrawals`
  ADD CONSTRAINT `fk_user_withdrawals_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `wallets`
--
ALTER TABLE `wallets`
  ADD CONSTRAINT `fk_wallets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
