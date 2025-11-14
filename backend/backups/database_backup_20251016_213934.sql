-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: db_banka
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `api_activitylog`
--

DROP TABLE IF EXISTS `api_activitylog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_activitylog` (
  `logId` int NOT NULL AUTO_INCREMENT,
  `action` varchar(255) NOT NULL,
  `timestamp` datetime(6) NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`logId`),
  KEY `api_activitylog_user_id_460724d0_fk_api_user_id` (`user_id`),
  CONSTRAINT `api_activitylog_user_id_460724d0_fk_api_user_id` FOREIGN KEY (`user_id`) REFERENCES `api_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_activitylog`
--

LOCK TABLES `api_activitylog` WRITE;
/*!40000 ALTER TABLE `api_activitylog` DISABLE KEYS */;
INSERT INTO `api_activitylog` VALUES (1,'Retrieved all fisherfolk records','2025-10-16 12:34:11.342815',1),(2,'UnknownUser fetched all users','2025-10-16 12:34:12.253779',1),(3,'UnknownUser fetched all users','2025-10-16 12:34:13.103848',1);
/*!40000 ALTER TABLE `api_activitylog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_address`
--

DROP TABLE IF EXISTS `api_address`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_address` (
  `address_log` int NOT NULL AUTO_INCREMENT,
  `street` varchar(255) NOT NULL,
  `barangay` varchar(100) NOT NULL,
  `municipality` varchar(100) NOT NULL,
  `province` varchar(100) NOT NULL,
  `region` varchar(100) NOT NULL,
  `residency_years` int unsigned NOT NULL,
  `barangay_verifier` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `verified_date` date DEFAULT NULL,
  `date_added` datetime(6) NOT NULL,
  `fisherfolk_id` varchar(50) NOT NULL,
  PRIMARY KEY (`address_log`),
  UNIQUE KEY `fisherfolk_id` (`fisherfolk_id`),
  CONSTRAINT `api_address_fisherfolk_id_c53fac96_fk_api_fishe` FOREIGN KEY (`fisherfolk_id`) REFERENCES `api_fisherfolk` (`registration_number`),
  CONSTRAINT `api_address_chk_1` CHECK ((`residency_years` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_address`
--

LOCK TABLES `api_address` WRITE;
/*!40000 ALTER TABLE `api_address` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_address` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_birukbilugtracker`
--

DROP TABLE IF EXISTS `api_birukbilugtracker`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_birukbilugtracker` (
  `BirukBilugID` varchar(50) NOT NULL,
  `municipality` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  `boat_id` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`BirukBilugID`),
  UNIQUE KEY `boat_id` (`boat_id`),
  CONSTRAINT `api_birukbilugtracker_boat_id_b2210d6e_fk_api_boat_mfbr_number` FOREIGN KEY (`boat_id`) REFERENCES `api_boat` (`mfbr_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_birukbilugtracker`
--

LOCK TABLES `api_birukbilugtracker` WRITE;
/*!40000 ALTER TABLE `api_birukbilugtracker` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_birukbilugtracker` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_boat`
--

DROP TABLE IF EXISTS `api_boat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_boat` (
  `mfbr_number` varchar(50) NOT NULL,
  `application_date` date NOT NULL,
  `type_of_registration` varchar(100) NOT NULL,
  `type_of_ownership` varchar(100) NOT NULL,
  `boat_name` varchar(100) NOT NULL,
  `boat_type` varchar(50) NOT NULL,
  `fishing_ground` varchar(100) NOT NULL,
  `fma_number` varchar(50) NOT NULL,
  `built_place` varchar(100) NOT NULL,
  `no_fishers` int NOT NULL,
  `material_used` varchar(100) NOT NULL,
  `homeport` varchar(100) NOT NULL,
  `built_year` int NOT NULL,
  `engine_make` varchar(100) NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `horsepower` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  `boat_image` varchar(100) DEFAULT NULL,
  `fisherfolk_registration_number_id` varchar(50) NOT NULL,
  `registered_municipality` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`mfbr_number`),
  KEY `api_boat_fisherfolk_registrat_4ce97038_fk_api_fishe` (`fisherfolk_registration_number_id`),
  CONSTRAINT `api_boat_fisherfolk_registrat_4ce97038_fk_api_fishe` FOREIGN KEY (`fisherfolk_registration_number_id`) REFERENCES `api_fisherfolk` (`registration_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_boat`
--

LOCK TABLES `api_boat` WRITE;
/*!40000 ALTER TABLE `api_boat` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_boat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_boatgearassignment`
--

DROP TABLE IF EXISTS `api_boatgearassignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_boatgearassignment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `boat_id` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `api_boatgearassignment_boat_id_2e854ddc_fk_api_boat_mfbr_number` (`boat_id`),
  CONSTRAINT `api_boatgearassignment_boat_id_2e854ddc_fk_api_boat_mfbr_number` FOREIGN KEY (`boat_id`) REFERENCES `api_boat` (`mfbr_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_boatgearassignment`
--

LOCK TABLES `api_boatgearassignment` WRITE;
/*!40000 ALTER TABLE `api_boatgearassignment` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_boatgearassignment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_boatgearsubtypeassignment`
--

DROP TABLE IF EXISTS `api_boatgearsubtypeassignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_boatgearsubtypeassignment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `is_present` tinyint(1) NOT NULL,
  `quantity` int DEFAULT NULL,
  `boat_gear_assignment_id` bigint NOT NULL,
  `gear_subtype_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `api_boatgearsubtypea_boat_gear_assignment_8983c49f_fk_api_boatg` (`boat_gear_assignment_id`),
  KEY `api_boatgearsubtypea_gear_subtype_id_4ab9fe6f_fk_api_gears` (`gear_subtype_id`),
  CONSTRAINT `api_boatgearsubtypea_boat_gear_assignment_8983c49f_fk_api_boatg` FOREIGN KEY (`boat_gear_assignment_id`) REFERENCES `api_boatgearassignment` (`id`),
  CONSTRAINT `api_boatgearsubtypea_gear_subtype_id_4ab9fe6f_fk_api_gears` FOREIGN KEY (`gear_subtype_id`) REFERENCES `api_gearsubtype` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_boatgearsubtypeassignment`
--

LOCK TABLES `api_boatgearsubtypeassignment` WRITE;
/*!40000 ALTER TABLE `api_boatgearsubtypeassignment` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_boatgearsubtypeassignment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_boatgeartypeassignment`
--

DROP TABLE IF EXISTS `api_boatgeartypeassignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_boatgeartypeassignment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `is_present` tinyint(1) NOT NULL,
  `boat_gear_assignment_id` bigint NOT NULL,
  `gear_type_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `api_boatgeartypeassi_boat_gear_assignment_ce68488e_fk_api_boatg` (`boat_gear_assignment_id`),
  KEY `api_boatgeartypeassi_gear_type_id_f7b47a8d_fk_api_geart` (`gear_type_id`),
  CONSTRAINT `api_boatgeartypeassi_boat_gear_assignment_ce68488e_fk_api_boatg` FOREIGN KEY (`boat_gear_assignment_id`) REFERENCES `api_boatgearassignment` (`id`),
  CONSTRAINT `api_boatgeartypeassi_gear_type_id_f7b47a8d_fk_api_geart` FOREIGN KEY (`gear_type_id`) REFERENCES `api_geartype` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_boatgeartypeassignment`
--

LOCK TABLES `api_boatgeartypeassignment` WRITE;
/*!40000 ALTER TABLE `api_boatgeartypeassignment` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_boatgeartypeassignment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_boatmeasurements`
--

DROP TABLE IF EXISTS `api_boatmeasurements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_boatmeasurements` (
  `boat_measure_id` int NOT NULL AUTO_INCREMENT,
  `registered_length` decimal(10,2) NOT NULL,
  `registered_breadth` decimal(10,2) NOT NULL,
  `registered_depth` decimal(10,2) NOT NULL,
  `tonnage_length` decimal(10,2) NOT NULL,
  `tonnage_breadth` decimal(10,2) NOT NULL,
  `tonnage_depth` decimal(10,2) NOT NULL,
  `gross_tonnage` decimal(10,2) NOT NULL,
  `net_tonnage` decimal(10,2) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  `boat_id` varchar(50) NOT NULL,
  PRIMARY KEY (`boat_measure_id`),
  UNIQUE KEY `boat_id` (`boat_id`),
  CONSTRAINT `api_boatmeasurements_boat_id_283f3e8c_fk_api_boat_mfbr_number` FOREIGN KEY (`boat_id`) REFERENCES `api_boat` (`mfbr_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_boatmeasurements`
--

LOCK TABLES `api_boatmeasurements` WRITE;
/*!40000 ALTER TABLE `api_boatmeasurements` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_boatmeasurements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_boundarycrossing`
--

DROP TABLE IF EXISTS `api_boundarycrossing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_boundarycrossing` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `boat_id` int NOT NULL,
  `from_municipality` varchar(100) NOT NULL,
  `to_municipality` varchar(100) NOT NULL,
  `crossing_timestamp` datetime(6) NOT NULL,
  `from_lat` double NOT NULL,
  `from_lng` double NOT NULL,
  `to_lat` double NOT NULL,
  `to_lng` double NOT NULL,
  `sms_sent` tinyint(1) NOT NULL,
  `sms_response` json DEFAULT NULL,
  `phone_number` varchar(20) NOT NULL,
  `fisherfolk_id` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `api_boundarycrossing_fisherfolk_id_333eec8d_fk_api_fishe` (`fisherfolk_id`),
  KEY `api_boundar_boat_id_742ab3_idx` (`boat_id`,`crossing_timestamp` DESC),
  KEY `api_boundar_crossin_5618a9_idx` (`crossing_timestamp`),
  KEY `api_boundar_from_mu_048daf_idx` (`from_municipality`,`to_municipality`),
  CONSTRAINT `api_boundarycrossing_fisherfolk_id_333eec8d_fk_api_fishe` FOREIGN KEY (`fisherfolk_id`) REFERENCES `api_fisherfolk` (`registration_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_boundarycrossing`
--

LOCK TABLES `api_boundarycrossing` WRITE;
/*!40000 ALTER TABLE `api_boundarycrossing` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_boundarycrossing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_boundaryviolationnotification`
--

DROP TABLE IF EXISTS `api_boundaryviolationnotification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_boundaryviolationnotification` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `boat_name` varchar(100) NOT NULL,
  `mfbr_number` varchar(50) NOT NULL,
  `tracker_number` varchar(50) NOT NULL,
  `from_municipality` varchar(100) NOT NULL,
  `to_municipality` varchar(100) NOT NULL,
  `violation_timestamp` datetime(6) NOT NULL,
  `current_lat` double NOT NULL,
  `current_lng` double NOT NULL,
  `dwell_duration` int NOT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `boat_id` varchar(50) DEFAULT NULL,
  `boundary_crossing_id` bigint NOT NULL,
  `fisherfolk_id` varchar(50) DEFAULT NULL,
  `read_by_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `api_boundaryviolatio_boundary_crossing_id_b113b1a9_fk_api_bound` (`boundary_crossing_id`),
  KEY `api_boundaryviolatio_fisherfolk_id_bd9ce2f8_fk_api_fishe` (`fisherfolk_id`),
  KEY `api_boundaryviolatio_read_by_id_5db2c9db_fk_api_user_` (`read_by_id`),
  KEY `api_boundar_created_8cd47b_idx` (`created_at` DESC),
  KEY `api_boundar_status_818b79_idx` (`status`,`created_at` DESC),
  KEY `api_boundar_boat_id_520853_idx` (`boat_id`,`created_at` DESC),
  CONSTRAINT `api_boundaryviolatio_boat_id_8f43c914_fk_api_boat_` FOREIGN KEY (`boat_id`) REFERENCES `api_boat` (`mfbr_number`),
  CONSTRAINT `api_boundaryviolatio_boundary_crossing_id_b113b1a9_fk_api_bound` FOREIGN KEY (`boundary_crossing_id`) REFERENCES `api_boundarycrossing` (`id`),
  CONSTRAINT `api_boundaryviolatio_fisherfolk_id_bd9ce2f8_fk_api_fishe` FOREIGN KEY (`fisherfolk_id`) REFERENCES `api_fisherfolk` (`registration_number`),
  CONSTRAINT `api_boundaryviolatio_read_by_id_5db2c9db_fk_api_user_` FOREIGN KEY (`read_by_id`) REFERENCES `api_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_boundaryviolationnotification`
--

LOCK TABLES `api_boundaryviolationnotification` WRITE;
/*!40000 ALTER TABLE `api_boundaryviolationnotification` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_boundaryviolationnotification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_contacts`
--

DROP TABLE IF EXISTS `api_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_contacts` (
  `contact_id` int NOT NULL AUTO_INCREMENT,
  `contact_fname` varchar(100) NOT NULL,
  `contact_mname` varchar(100) NOT NULL,
  `contact_lname` varchar(100) NOT NULL,
  `contact_street` varchar(100) NOT NULL,
  `contact_relationship` varchar(100) NOT NULL,
  `contact_contactno` varchar(20) NOT NULL,
  `contact_municipality` varchar(255) NOT NULL,
  `contact_barangay` varchar(255) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  `fisherfolk_id` varchar(50) NOT NULL,
  PRIMARY KEY (`contact_id`),
  UNIQUE KEY `fisherfolk_id` (`fisherfolk_id`),
  CONSTRAINT `api_contacts_fisherfolk_id_7a31edb0_fk_api_fishe` FOREIGN KEY (`fisherfolk_id`) REFERENCES `api_fisherfolk` (`registration_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_contacts`
--

LOCK TABLES `api_contacts` WRITE;
/*!40000 ALTER TABLE `api_contacts` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_devicetoken`
--

DROP TABLE IF EXISTS `api_devicetoken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_devicetoken` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `token` varchar(64) NOT NULL,
  `boat_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `last_seen_at` datetime(6) DEFAULT NULL,
  `tracker_id` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  UNIQUE KEY `tracker_id` (`tracker_id`),
  KEY `api_devicet_token_c881c8_idx` (`token`),
  KEY `api_devicet_name_fcd7e9_idx` (`name`),
  KEY `api_devicet_last_se_9bb828_idx` (`last_seen_at` DESC),
  CONSTRAINT `api_devicetoken_tracker_id_9111fc33_fk_api_biruk` FOREIGN KEY (`tracker_id`) REFERENCES `api_birukbilugtracker` (`BirukBilugID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_devicetoken`
--

LOCK TABLES `api_devicetoken` WRITE;
/*!40000 ALTER TABLE `api_devicetoken` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_devicetoken` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_fisherfolk`
--

DROP TABLE IF EXISTS `api_fisherfolk`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_fisherfolk` (
  `registration_number` varchar(50) NOT NULL,
  `salutations` varchar(5) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `appelation` varchar(20) DEFAULT NULL,
  `birth_date` date NOT NULL,
  `age` int unsigned DEFAULT NULL,
  `birth_place` varchar(200) NOT NULL,
  `civil_status` varchar(20) NOT NULL,
  `sex` varchar(10) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `nationality` varchar(100) NOT NULL,
  `fisherfolk_status` varchar(50) DEFAULT NULL,
  `mothers_maidenname` varchar(100) DEFAULT NULL,
  `fishing_ground` varchar(100) DEFAULT NULL,
  `fma_number` varchar(50) DEFAULT NULL,
  `religion` varchar(30) DEFAULT NULL,
  `educational_background` varchar(20) DEFAULT NULL,
  `household_month_income` varchar(100) DEFAULT NULL,
  `other_source_income` varchar(100) DEFAULT NULL,
  `farming_income` tinyint(1) NOT NULL,
  `farming_income_salary` decimal(10,2) DEFAULT NULL,
  `fisheries_income` tinyint(1) NOT NULL,
  `fisheries_income_salary` decimal(10,2) DEFAULT NULL,
  `with_voterID` tinyint(1) NOT NULL,
  `voterID_number` varchar(50) DEFAULT NULL,
  `is_CCT_4ps` tinyint(1) NOT NULL,
  `is_ICC` tinyint(1) NOT NULL,
  `main_source_livelihood` varchar(30) DEFAULT NULL,
  `other_source_livelihood` varchar(72) DEFAULT NULL,
  `fisherfolk_img` varchar(100) DEFAULT NULL,
  `date_added` datetime(6) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_by_id` int DEFAULT NULL,
  PRIMARY KEY (`registration_number`),
  KEY `api_fisherfolk_created_by_id_0a8d9927_fk_api_user_id` (`created_by_id`),
  CONSTRAINT `api_fisherfolk_created_by_id_0a8d9927_fk_api_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `api_user` (`id`),
  CONSTRAINT `api_fisherfolk_chk_1` CHECK ((`age` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_fisherfolk`
--

LOCK TABLES `api_fisherfolk` WRITE;
/*!40000 ALTER TABLE `api_fisherfolk` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_fisherfolk` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_fisherfolkboat`
--

DROP TABLE IF EXISTS `api_fisherfolkboat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_fisherfolkboat` (
  `boat_registry_no` int NOT NULL AUTO_INCREMENT,
  `type_of_ownership` varchar(50) NOT NULL,
  `no_of_fishers` int NOT NULL,
  `homeport` varchar(100) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `mfbr_number_id` varchar(50) NOT NULL,
  `registration_number_id` varchar(50) NOT NULL,
  PRIMARY KEY (`boat_registry_no`),
  KEY `api_fisherfolkboat_mfbr_number_id_47189533_fk_api_boat_` (`mfbr_number_id`),
  KEY `api_fisherfolkboat_registration_number__7a8fa97d_fk_api_fishe` (`registration_number_id`),
  CONSTRAINT `api_fisherfolkboat_mfbr_number_id_47189533_fk_api_boat_` FOREIGN KEY (`mfbr_number_id`) REFERENCES `api_boat` (`mfbr_number`),
  CONSTRAINT `api_fisherfolkboat_registration_number__7a8fa97d_fk_api_fishe` FOREIGN KEY (`registration_number_id`) REFERENCES `api_fisherfolk` (`registration_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_fisherfolkboat`
--

LOCK TABLES `api_fisherfolkboat` WRITE;
/*!40000 ALTER TABLE `api_fisherfolkboat` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_fisherfolkboat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_gearclassification`
--

DROP TABLE IF EXISTS `api_gearclassification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_gearclassification` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_gearclassification`
--

LOCK TABLES `api_gearclassification` WRITE;
/*!40000 ALTER TABLE `api_gearclassification` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_gearclassification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_gearsubtype`
--

DROP TABLE IF EXISTS `api_gearsubtype`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_gearsubtype` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `gear_type_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `api_gearsubtype_gear_type_id_dccc4834_fk_api_geartype_id` (`gear_type_id`),
  CONSTRAINT `api_gearsubtype_gear_type_id_dccc4834_fk_api_geartype_id` FOREIGN KEY (`gear_type_id`) REFERENCES `api_geartype` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_gearsubtype`
--

LOCK TABLES `api_gearsubtype` WRITE;
/*!40000 ALTER TABLE `api_gearsubtype` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_gearsubtype` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_geartype`
--

DROP TABLE IF EXISTS `api_geartype`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_geartype` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `classification_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `api_geartype_classification_id_c3a862d2_fk_api_gearc` (`classification_id`),
  CONSTRAINT `api_geartype_classification_id_c3a862d2_fk_api_gearc` FOREIGN KEY (`classification_id`) REFERENCES `api_gearclassification` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_geartype`
--

LOCK TABLES `api_geartype` WRITE;
/*!40000 ALTER TABLE `api_geartype` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_geartype` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_gpsdata`
--

DROP TABLE IF EXISTS `api_gpsdata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_gpsdata` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `boat_id` int NOT NULL,
  `mfbr_number` varchar(50) DEFAULT NULL,
  `tracker_id` varchar(50) DEFAULT NULL,
  `timestamp` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_gpsdata`
--

LOCK TABLES `api_gpsdata` WRITE;
/*!40000 ALTER TABLE `api_gpsdata` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_gpsdata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_household`
--

DROP TABLE IF EXISTS `api_household`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_household` (
  `household_number` int NOT NULL AUTO_INCREMENT,
  `total_no_household_memb` int unsigned NOT NULL,
  `no_male` int unsigned NOT NULL,
  `no_female` int unsigned NOT NULL,
  `no_children` int unsigned NOT NULL,
  `no_in_school` int unsigned NOT NULL,
  `no_out_school` int unsigned NOT NULL,
  `no_employed` int unsigned NOT NULL,
  `no_unemployed` int unsigned NOT NULL,
  `date_added` datetime(6) NOT NULL,
  `fisherfolk_id` varchar(50) NOT NULL,
  PRIMARY KEY (`household_number`),
  UNIQUE KEY `fisherfolk_id` (`fisherfolk_id`),
  CONSTRAINT `api_household_fisherfolk_id_f68231f1_fk_api_fishe` FOREIGN KEY (`fisherfolk_id`) REFERENCES `api_fisherfolk` (`registration_number`),
  CONSTRAINT `api_household_chk_1` CHECK ((`total_no_household_memb` >= 0)),
  CONSTRAINT `api_household_chk_2` CHECK ((`no_male` >= 0)),
  CONSTRAINT `api_household_chk_3` CHECK ((`no_female` >= 0)),
  CONSTRAINT `api_household_chk_4` CHECK ((`no_children` >= 0)),
  CONSTRAINT `api_household_chk_5` CHECK ((`no_in_school` >= 0)),
  CONSTRAINT `api_household_chk_6` CHECK ((`no_out_school` >= 0)),
  CONSTRAINT `api_household_chk_7` CHECK ((`no_employed` >= 0)),
  CONSTRAINT `api_household_chk_8` CHECK ((`no_unemployed` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_household`
--

LOCK TABLES `api_household` WRITE;
/*!40000 ALTER TABLE `api_household` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_household` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_landboundary`
--

DROP TABLE IF EXISTS `api_landboundary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_landboundary` (
  `land_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `land_area` decimal(10,4) NOT NULL,
  `boundary_length` decimal(10,4) NOT NULL,
  `coordinates` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`land_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_landboundary`
--

LOCK TABLES `api_landboundary` WRITE;
/*!40000 ALTER TABLE `api_landboundary` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_landboundary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_municipalagriculturist`
--

DROP TABLE IF EXISTS `api_municipalagriculturist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_municipalagriculturist` (
  `municipal_agriculturist_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `sex` varchar(10) NOT NULL,
  `municipality` varchar(100) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `position` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  PRIMARY KEY (`municipal_agriculturist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_municipalagriculturist`
--

LOCK TABLES `api_municipalagriculturist` WRITE;
/*!40000 ALTER TABLE `api_municipalagriculturist` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_municipalagriculturist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_municipalityboundary`
--

DROP TABLE IF EXISTS `api_municipalityboundary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_municipalityboundary` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `water_area` decimal(10,4) NOT NULL,
  `coastline_length` decimal(10,4) NOT NULL,
  `coordinates` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_municipalityboundary`
--

LOCK TABLES `api_municipalityboundary` WRITE;
/*!40000 ALTER TABLE `api_municipalityboundary` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_municipalityboundary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_organization`
--

DROP TABLE IF EXISTS `api_organization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_organization` (
  `org_id` int NOT NULL AUTO_INCREMENT,
  `org_name` varchar(255) DEFAULT NULL,
  `member_since` date DEFAULT NULL,
  `org_position` varchar(100) DEFAULT NULL,
  `date_added` datetime(6) NOT NULL,
  `fisherfolk_id` varchar(50) NOT NULL,
  PRIMARY KEY (`org_id`),
  KEY `api_organization_fisherfolk_id_5ce36b11_fk_api_fishe` (`fisherfolk_id`),
  CONSTRAINT `api_organization_fisherfolk_id_5ce36b11_fk_api_fishe` FOREIGN KEY (`fisherfolk_id`) REFERENCES `api_fisherfolk` (`registration_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_organization`
--

LOCK TABLES `api_organization` WRITE;
/*!40000 ALTER TABLE `api_organization` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_organization` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_provincialagriculturist`
--

DROP TABLE IF EXISTS `api_provincialagriculturist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_provincialagriculturist` (
  `provincial_agriculturist_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `sex` varchar(10) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `position` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  PRIMARY KEY (`provincial_agriculturist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_provincialagriculturist`
--

LOCK TABLES `api_provincialagriculturist` WRITE;
/*!40000 ALTER TABLE `api_provincialagriculturist` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_provincialagriculturist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_user`
--

DROP TABLE IF EXISTS `api_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `password` varchar(128) NOT NULL,
  `email` varchar(254) NOT NULL,
  `sex` varchar(10) DEFAULT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `user_role` varchar(30) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `must_change_password` tinyint(1) NOT NULL,
  `date_added` datetime(6) NOT NULL,
  `municipal_agriculturist_id` int DEFAULT NULL,
  `provincial_agriculturist_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `api_user_municipal_agricultur_bc60ea9c_fk_api_munic` (`municipal_agriculturist_id`),
  KEY `api_user_provincial_agricultu_83a4c28a_fk_api_provi` (`provincial_agriculturist_id`),
  CONSTRAINT `api_user_municipal_agricultur_bc60ea9c_fk_api_munic` FOREIGN KEY (`municipal_agriculturist_id`) REFERENCES `api_municipalagriculturist` (`municipal_agriculturist_id`),
  CONSTRAINT `api_user_provincial_agricultu_83a4c28a_fk_api_provi` FOREIGN KEY (`provincial_agriculturist_id`) REFERENCES `api_provincialagriculturist` (`provincial_agriculturist_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_user`
--

LOCK TABLES `api_user` WRITE;
/*!40000 ALTER TABLE `api_user` DISABLE KEYS */;
INSERT INTO `api_user` VALUES (1,'pbkdf2_sha256$1000000$4DPoPyq0zwVBcFKRKyW1Ak$YsWJhCW5qB78YpVaUxd9bWrIUyrIZDmqyIdRozeWN2I=','admin@gmail.com',NULL,NULL,1,1,'admin',1,0,'2025-10-16 12:32:52.151417',NULL,NULL);
/*!40000 ALTER TABLE `api_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_user_groups`
--

DROP TABLE IF EXISTS `api_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_user_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `group_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_user_groups_user_id_group_id_9c7ddfb5_uniq` (`user_id`,`group_id`),
  KEY `api_user_groups_group_id_3af85785_fk_auth_group_id` (`group_id`),
  CONSTRAINT `api_user_groups_group_id_3af85785_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `api_user_groups_user_id_a5ff39fa_fk_api_user_id` FOREIGN KEY (`user_id`) REFERENCES `api_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_user_groups`
--

LOCK TABLES `api_user_groups` WRITE;
/*!40000 ALTER TABLE `api_user_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_user_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_user_user_permissions`
--

DROP TABLE IF EXISTS `api_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_user_user_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_user_user_permissions_user_id_permission_id_a06dd704_uniq` (`user_id`,`permission_id`),
  KEY `api_user_user_permis_permission_id_305b7fea_fk_auth_perm` (`permission_id`),
  CONSTRAINT `api_user_user_permis_permission_id_305b7fea_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `api_user_user_permissions_user_id_f3945d65_fk_api_user_id` FOREIGN KEY (`user_id`) REFERENCES `api_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_user_user_permissions`
--

LOCK TABLES `api_user_user_permissions` WRITE;
/*!40000 ALTER TABLE `api_user_user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_user_user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group`
--

LOCK TABLES `auth_group` WRITE;
/*!40000 ALTER TABLE `auth_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group_permissions`
--

LOCK TABLES `auth_group_permissions` WRITE;
/*!40000 ALTER TABLE `auth_group_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_permission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `content_type_id` int NOT NULL,
  `codename` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=121 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_permission`
--

LOCK TABLES `auth_permission` WRITE;
/*!40000 ALTER TABLE `auth_permission` DISABLE KEYS */;
INSERT INTO `auth_permission` VALUES (1,'Can add log entry',1,'add_logentry'),(2,'Can change log entry',1,'change_logentry'),(3,'Can delete log entry',1,'delete_logentry'),(4,'Can view log entry',1,'view_logentry'),(5,'Can add permission',2,'add_permission'),(6,'Can change permission',2,'change_permission'),(7,'Can delete permission',2,'delete_permission'),(8,'Can view permission',2,'view_permission'),(9,'Can add group',3,'add_group'),(10,'Can change group',3,'change_group'),(11,'Can delete group',3,'delete_group'),(12,'Can view group',3,'view_group'),(13,'Can add content type',4,'add_contenttype'),(14,'Can change content type',4,'change_contenttype'),(15,'Can delete content type',4,'delete_contenttype'),(16,'Can view content type',4,'view_contenttype'),(17,'Can add session',5,'add_session'),(18,'Can change session',5,'change_session'),(19,'Can delete session',5,'delete_session'),(20,'Can view session',5,'view_session'),(21,'Can add boat',6,'add_boat'),(22,'Can change boat',6,'change_boat'),(23,'Can delete boat',6,'delete_boat'),(24,'Can view boat',6,'view_boat'),(25,'Can add gear classification',7,'add_gearclassification'),(26,'Can change gear classification',7,'change_gearclassification'),(27,'Can delete gear classification',7,'delete_gearclassification'),(28,'Can view gear classification',7,'view_gearclassification'),(29,'Can add gear subtype',8,'add_gearsubtype'),(30,'Can change gear subtype',8,'change_gearsubtype'),(31,'Can delete gear subtype',8,'delete_gearsubtype'),(32,'Can view gear subtype',8,'view_gearsubtype'),(33,'Can add gps data',9,'add_gpsdata'),(34,'Can change gps data',9,'change_gpsdata'),(35,'Can delete gps data',9,'delete_gpsdata'),(36,'Can view gps data',9,'view_gpsdata'),(37,'Can add land boundary',10,'add_landboundary'),(38,'Can change land boundary',10,'change_landboundary'),(39,'Can delete land boundary',10,'delete_landboundary'),(40,'Can view land boundary',10,'view_landboundary'),(41,'Can add municipal agriculturist',11,'add_municipalagriculturist'),(42,'Can change municipal agriculturist',11,'change_municipalagriculturist'),(43,'Can delete municipal agriculturist',11,'delete_municipalagriculturist'),(44,'Can view municipal agriculturist',11,'view_municipalagriculturist'),(45,'Can add municipality boundary',12,'add_municipalityboundary'),(46,'Can change municipality boundary',12,'change_municipalityboundary'),(47,'Can delete municipality boundary',12,'delete_municipalityboundary'),(48,'Can view municipality boundary',12,'view_municipalityboundary'),(49,'Can add provincial agriculturist',13,'add_provincialagriculturist'),(50,'Can change provincial agriculturist',13,'change_provincialagriculturist'),(51,'Can delete provincial agriculturist',13,'delete_provincialagriculturist'),(52,'Can view provincial agriculturist',13,'view_provincialagriculturist'),(53,'Can add user',14,'add_user'),(54,'Can change user',14,'change_user'),(55,'Can delete user',14,'delete_user'),(56,'Can view user',14,'view_user'),(57,'Can add activity log',15,'add_activitylog'),(58,'Can change activity log',15,'change_activitylog'),(59,'Can delete activity log',15,'delete_activitylog'),(60,'Can view activity log',15,'view_activitylog'),(61,'Can add birukbilug tracker',16,'add_birukbilugtracker'),(62,'Can change birukbilug tracker',16,'change_birukbilugtracker'),(63,'Can delete birukbilug tracker',16,'delete_birukbilugtracker'),(64,'Can view birukbilug tracker',16,'view_birukbilugtracker'),(65,'Can add boat gear assignment',17,'add_boatgearassignment'),(66,'Can change boat gear assignment',17,'change_boatgearassignment'),(67,'Can delete boat gear assignment',17,'delete_boatgearassignment'),(68,'Can view boat gear assignment',17,'view_boatgearassignment'),(69,'Can add boat measurements',18,'add_boatmeasurements'),(70,'Can change boat measurements',18,'change_boatmeasurements'),(71,'Can delete boat measurements',18,'delete_boatmeasurements'),(72,'Can view boat measurements',18,'view_boatmeasurements'),(73,'Can add fisherfolk',19,'add_fisherfolk'),(74,'Can change fisherfolk',19,'change_fisherfolk'),(75,'Can delete fisherfolk',19,'delete_fisherfolk'),(76,'Can view fisherfolk',19,'view_fisherfolk'),(77,'Can add contacts',20,'add_contacts'),(78,'Can change contacts',20,'change_contacts'),(79,'Can delete contacts',20,'delete_contacts'),(80,'Can view contacts',20,'view_contacts'),(81,'Can add address',21,'add_address'),(82,'Can change address',21,'change_address'),(83,'Can delete address',21,'delete_address'),(84,'Can view address',21,'view_address'),(85,'Can add fisherfolk boat',22,'add_fisherfolkboat'),(86,'Can change fisherfolk boat',22,'change_fisherfolkboat'),(87,'Can delete fisherfolk boat',22,'delete_fisherfolkboat'),(88,'Can view fisherfolk boat',22,'view_fisherfolkboat'),(89,'Can add boat gear subtype assignment',23,'add_boatgearsubtypeassignment'),(90,'Can change boat gear subtype assignment',23,'change_boatgearsubtypeassignment'),(91,'Can delete boat gear subtype assignment',23,'delete_boatgearsubtypeassignment'),(92,'Can view boat gear subtype assignment',23,'view_boatgearsubtypeassignment'),(93,'Can add gear type',24,'add_geartype'),(94,'Can change gear type',24,'change_geartype'),(95,'Can delete gear type',24,'delete_geartype'),(96,'Can view gear type',24,'view_geartype'),(97,'Can add boat gear type assignment',25,'add_boatgeartypeassignment'),(98,'Can change boat gear type assignment',25,'change_boatgeartypeassignment'),(99,'Can delete boat gear type assignment',25,'delete_boatgeartypeassignment'),(100,'Can view boat gear type assignment',25,'view_boatgeartypeassignment'),(101,'Can add household',26,'add_household'),(102,'Can change household',26,'change_household'),(103,'Can delete household',26,'delete_household'),(104,'Can view household',26,'view_household'),(105,'Can add organization',27,'add_organization'),(106,'Can change organization',27,'change_organization'),(107,'Can delete organization',27,'delete_organization'),(108,'Can view organization',27,'view_organization'),(109,'Can add device token',28,'add_devicetoken'),(110,'Can change device token',28,'change_devicetoken'),(111,'Can delete device token',28,'delete_devicetoken'),(112,'Can view device token',28,'view_devicetoken'),(113,'Can add boundary crossing',29,'add_boundarycrossing'),(114,'Can change boundary crossing',29,'change_boundarycrossing'),(115,'Can delete boundary crossing',29,'delete_boundarycrossing'),(116,'Can view boundary crossing',29,'view_boundarycrossing'),(117,'Can add boundary violation notification',30,'add_boundaryviolationnotification'),(118,'Can change boundary violation notification',30,'change_boundaryviolationnotification'),(119,'Can delete boundary violation notification',30,'delete_boundaryviolationnotification'),(120,'Can view boundary violation notification',30,'view_boundaryviolationnotification');
/*!40000 ALTER TABLE `auth_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_admin_log`
--

DROP TABLE IF EXISTS `django_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_admin_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext,
  `object_repr` varchar(200) NOT NULL,
  `action_flag` smallint unsigned NOT NULL,
  `change_message` longtext NOT NULL,
  `content_type_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  KEY `django_admin_log_user_id_c564eba6_fk_api_user_id` (`user_id`),
  CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  CONSTRAINT `django_admin_log_user_id_c564eba6_fk_api_user_id` FOREIGN KEY (`user_id`) REFERENCES `api_user` (`id`),
  CONSTRAINT `django_admin_log_chk_1` CHECK ((`action_flag` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_admin_log`
--

LOCK TABLES `django_admin_log` WRITE;
/*!40000 ALTER TABLE `django_admin_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `django_admin_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_content_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_content_type`
--

LOCK TABLES `django_content_type` WRITE;
/*!40000 ALTER TABLE `django_content_type` DISABLE KEYS */;
INSERT INTO `django_content_type` VALUES (1,'admin','logentry'),(15,'api','activitylog'),(21,'api','address'),(16,'api','birukbilugtracker'),(6,'api','boat'),(17,'api','boatgearassignment'),(23,'api','boatgearsubtypeassignment'),(25,'api','boatgeartypeassignment'),(18,'api','boatmeasurements'),(29,'api','boundarycrossing'),(30,'api','boundaryviolationnotification'),(20,'api','contacts'),(28,'api','devicetoken'),(19,'api','fisherfolk'),(22,'api','fisherfolkboat'),(7,'api','gearclassification'),(8,'api','gearsubtype'),(24,'api','geartype'),(9,'api','gpsdata'),(26,'api','household'),(10,'api','landboundary'),(11,'api','municipalagriculturist'),(12,'api','municipalityboundary'),(27,'api','organization'),(13,'api','provincialagriculturist'),(14,'api','user'),(3,'auth','group'),(2,'auth','permission'),(4,'contenttypes','contenttype'),(5,'sessions','session');
/*!40000 ALTER TABLE `django_content_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_migrations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_migrations`
--

LOCK TABLES `django_migrations` WRITE;
/*!40000 ALTER TABLE `django_migrations` DISABLE KEYS */;
INSERT INTO `django_migrations` VALUES (1,'contenttypes','0001_initial','2025-10-16 12:32:15.050976'),(2,'contenttypes','0002_remove_content_type_name','2025-10-16 12:32:15.109063'),(3,'auth','0001_initial','2025-10-16 12:32:15.266187'),(4,'auth','0002_alter_permission_name_max_length','2025-10-16 12:32:15.301464'),(5,'auth','0003_alter_user_email_max_length','2025-10-16 12:32:15.304555'),(6,'auth','0004_alter_user_username_opts','2025-10-16 12:32:15.307592'),(7,'auth','0005_alter_user_last_login_null','2025-10-16 12:32:15.310563'),(8,'auth','0006_require_contenttypes_0002','2025-10-16 12:32:15.311587'),(9,'auth','0007_alter_validators_add_error_messages','2025-10-16 12:32:15.314280'),(10,'auth','0008_alter_user_username_max_length','2025-10-16 12:32:15.316879'),(11,'auth','0009_alter_user_last_name_max_length','2025-10-16 12:32:15.320012'),(12,'auth','0010_alter_group_name_max_length','2025-10-16 12:32:15.329761'),(13,'auth','0011_update_proxy_permissions','2025-10-16 12:32:15.334126'),(14,'auth','0012_alter_user_first_name_max_length','2025-10-16 12:32:15.337357'),(15,'api','0001_initial','2025-10-16 12:32:16.766909'),(16,'admin','0001_initial','2025-10-16 12:32:16.875053'),(17,'admin','0002_logentry_remove_auto_add','2025-10-16 12:32:16.881207'),(18,'admin','0003_logentry_add_action_flag_choices','2025-10-16 12:32:16.888954'),(19,'api','0002_boundaryviolationnotification','2025-10-16 12:32:17.090008'),(20,'api','0003_add_registered_municipality_to_boat','2025-10-16 12:32:17.138429'),(21,'sessions','0001_initial','2025-10-16 12:32:17.160669');
/*!40000 ALTER TABLE `django_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_session`
--

DROP TABLE IF EXISTS `django_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime(6) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_session`
--

LOCK TABLES `django_session` WRITE;
/*!40000 ALTER TABLE `django_session` DISABLE KEYS */;
/*!40000 ALTER TABLE `django_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'db_banka'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-16 21:39:34
