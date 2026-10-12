import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import 'auth_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = ApiClient();
  final _auth = AuthService();
  String _apiState = 'Checking API connection…';
  Map<String, dynamic>? _currentUser;
  bool _loadingProfile = true;
  bool _educationLoading = false;
  String _educationError = '';
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _courses = [];
  List<Map<String, dynamic>> _attendance = [];

  @override
  void initState() {
    super.initState();
    _checkApi();
    _restoreSession();
  }

  Future<void> _checkApi() async {
    try {
      final result = await _api.getHealth();
      if (!mounted) return;
      setState(() => _apiState = result['status'] == 'ok' ? 'API connected' : 'API available with warnings');
    } catch (_) {
      if (!mounted) return;
      setState(() => _apiState = 'API not reachable — configure API URL');
    }
  }

  Future<void> _restoreSession() async {
    try {
      final user = await _auth.currentUser();
      if (!mounted) return;
      setState(() { _currentUser = user; _loadingProfile = false; });
      if (user != null) await _loadEducation();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingProfile = false);
    }
  }

  Future<void> _loadEducation() async {
    if (_currentUser == null) {
      if (mounted) setState(() { _classes = []; _courses = []; _attendance = []; _educationError = ''; _educationLoading = false; });
      return;
    }
    setState(() { _educationLoading = true; _educationError = ''; });
    try {
      final summary = await _auth.educationSummary();
      if (!mounted) return;
      setState(() {
        _classes = (summary['classes'] as List<dynamic>? ?? <dynamic>[])
            .map((item) => Map<String, dynamic>.from(item as Map)).toList();
        _courses = (summary['courses'] as List<dynamic>? ?? <dynamic>[])
            .map((item) => Map<String, dynamic>.from(item as Map)).toList();
        _attendance = (summary['attendance'] as List<dynamic>? ?? <dynamic>[])
            .map((item) => Map<String, dynamic>.from(item as Map)).toList();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _educationError = error is ApiException ? error.message : 'Could not load your education dashboard.');
    } finally {
      if (mounted) setState(() => _educationLoading = false);
    }
  }

  Future<void> _openCourse(Map<String, dynamic> course) async {
    final courseId = course['id']?.toString();
    if (courseId == null || courseId.isEmpty) return;
    try {
      final lessons = await _auth.courseLessons(courseId);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (sheetContext) => SafeArea(child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(course['title']?.toString() ?? 'Course', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF101D3A))),
            const SizedBox(height: 7),
            Text(course['description']?.toString() ?? '', style: const TextStyle(fontSize: 11, height: 1.6, color: Color(0xFF687891))),
            const SizedBox(height: 12),
            if (lessons.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Text('No published lessons are available yet.', style: TextStyle(fontSize: 12, color: Color(0xFF687891))))
            else
              SizedBox(height: MediaQuery.of(sheetContext).size.height * .52, child: ListView.separated(
                shrinkWrap: true,
                itemCount: lessons.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final lesson = lessons[index];
                  return Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${lesson['sortOrder'] ?? index + 1}. ${lesson['title'] ?? 'Lesson'}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    if ((lesson['description'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 5), child: Text(lesson['description'].toString(), style: const TextStyle(fontSize: 11, color: Color(0xFF687891)))),
                    if ((lesson['contentText'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(lesson['contentText'].toString(), style: const TextStyle(fontSize: 12, height: 1.7))),
                    if ((lesson['contentUrl'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: SelectableText(lesson['contentUrl'].toString(), style: const TextStyle(fontSize: 11, color: Color(0xFF1769FF)))),
                  ]));
                },
              )),
          ]),
        )),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error is ApiException ? error.message : 'Could not load course lessons.')));
    }
  }

  Future<void> _openAccount() async {
    if (_currentUser == null) {
      final user = await Navigator.of(context).push<Map<String, dynamic>>(
        MaterialPageRoute(builder: (_) => const AuthScreen()),
      );
      if (!mounted) return;
      if (user != null) {
        setState(() => _currentUser = user);
        await _loadEducation();
      }
      return;
    }

    final rawProfiles = _currentUser?['profileRoles'];
    final profileRoles = rawProfiles is List
        ? rawProfiles.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList()
        : <Map<String, dynamic>>[];
    final rawActiveProfile = _currentUser?['activeProfile'];
    final activeProfileId = rawActiveProfile is Map ? rawActiveProfile['id']?.toString() : null;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 10, 22, 25),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(_currentUser?['fullName']?.toString() ?? 'SkillHeed user', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text(_currentUser?['email']?.toString() ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF687891))),
          const SizedBox(height: 8),
          Text('Active role: ${_currentUser?['activeRole'] ?? _currentUser?['role'] ?? 'USER'}', style: const TextStyle(fontSize: 11, color: Color(0xFF687891))),
          const SizedBox(height: 20),
          const Text('Switch profile', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          const Text('Each profile is validated by the API against its assigned scope.', style: TextStyle(fontSize: 10, height: 1.6, color: Color(0xFF687891))),
          const SizedBox(height: 8),
          ListTile(
            dense: true,
            selected: activeProfileId == null,
            leading: const Icon(Icons.person_outline),
            title: const Text('Use main account role', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            subtitle: Text((_currentUser?['role'] ?? 'USER').toString(), style: const TextStyle(fontSize: 10)),
            onTap: () => _switchProfile(sheetContext, null),
          ),
          if (profileRoles.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('No additional profiles have been assigned to this account.', style: TextStyle(fontSize: 11, color: Color(0xFF687891))))
          else
            ...profileRoles.map((profile) {
              final id = profile['id']?.toString() ?? '';
              final profileType = _prettyProfile(profile['profileType']?.toString() ?? 'PROFILE');
              final scope = profile['scopeType']?.toString() ?? 'SELF';
              final organization = profile['organization'];
              final territory = profile['territory'];
              final branch = profile['branch'];
              final scopeLabel = organization is Map
                  ? '${organization['name']}${branch is Map ? ' / ${branch['name']}' : ''}'
                  : territory is Map ? '${territory['name']} · ${territory['level']}' : scope;
              return ListTile(
                dense: true,
                selected: id == activeProfileId,
                leading: const Icon(Icons.badge_outlined),
                title: Text(profileType, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                subtitle: Text('${profile['accessRole']} · $scopeLabel', style: const TextStyle(fontSize: 10)),
                trailing: profile['isDefault'] == true ? const Icon(Icons.star_rounded, size: 16, color: Color(0xFF1769FF)) : null,
                onTap: () => _switchProfile(sheetContext, id),
              );
            }),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async {
              await _auth.logout();
              if (!mounted || !sheetContext.mounted) return;
              Navigator.of(sheetContext).pop();
              setState(() { _currentUser = null; _classes = []; _courses = []; _attendance = []; _educationError = ''; });
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ]),
      )),
    );
  }

  Future<void> _switchProfile(BuildContext sheetContext, String? profileId) async {
    try {
      if (profileId == null || profileId.isEmpty) {
        await _auth.clearSelectedProfile();
      } else {
        await _auth.selectProfile(profileId);
      }
      final refreshedUser = await _auth.currentUser();
      if (!mounted || !sheetContext.mounted) return;
      Navigator.of(sheetContext).pop();
      if (refreshedUser != null) {
        setState(() => _currentUser = refreshedUser);
        await _loadEducation();
      }
    } catch (_) {
      if (!mounted || !sheetContext.mounted) return;
      Navigator.of(sheetContext).pop();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not switch profile. Please try again.')));
    }
  }

  String _prettyProfile(String value) {
    return value.toLowerCase().split('_').map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}').join(' ');
  }

  void _showInfo(BuildContext context, String title, String body) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(22, 10, 22, 30),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          const SizedBox(height: 9),
          Text(body, style: const TextStyle(fontSize: 13, height: 1.65, color: Color(0xFF687891))),
        ]),
      ),
    );
  }

  Widget _summaryTile(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 11),
      decoration: BoxDecoration(color: const Color(0xFFF6F9FF), borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 17, color: const Color(0xFF1769FF)),
        const SizedBox(height: 8),
        Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF101D3A))),
        Text(label, style: const TextStyle(fontSize: 9, color: Color(0xFF71829C))),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final modules = [
      ('Smart Learning','Courses, lessons and learning paths',Icons.school_outlined,const Color(0xFFEAF3FF)),
      ('AI Assessments','Discover aptitude, interests and skills',Icons.psychology_alt_outlined,const Color(0xFFF1EDFF)),
      ('Mentorship','Guidance and career roadmaps',Icons.diversity_3_outlined,const Color(0xFFE7FBF0)),
      ('Jobs & Internships','Explore skills-based opportunities',Icons.work_outline,const Color(0xFFFFF0E8)),
      ('Olympiads & Quests','Join challenges and competitions',Icons.emoji_events_outlined,const Color(0xFFFFF5DF)),
      ('Sports & Talent','Showcase achievements and discover events',Icons.sports_soccer_outlined,const Color(0xFFE7FAFF)),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7FAFF),
        title: Row(children: [
          Container(
            width: 36, height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: const Color(0xFF1769FF), borderRadius: BorderRadius.circular(12)),
            child: const Text('S', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 21)),
          ),
          const SizedBox(width: 10),
          const Text('SkillHeed', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -.5)),
        ]),
        actions: [
          IconButton(onPressed: () async { await _checkApi(); await _loadEducation(); }, icon: const Icon(Icons.sync_rounded), tooltip: 'Refresh data'),
          IconButton(onPressed: _openAccount, icon: Icon(_currentUser == null ? Icons.person_outline : Icons.account_circle_outlined), tooltip: _currentUser == null ? 'Sign in' : 'Account'),
        ],
      ),
      body: SafeArea(child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 30),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              gradient: const LinearGradient(colors: [Color(0xFFEAF4FF), Color(0xFFD7E9FF)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('YOUR GROWTH, CONNECTED', style: TextStyle(fontSize: 10, letterSpacing: 1, fontWeight: FontWeight.w800, color: Color(0xFF41628B))),
              const SizedBox(height: 15),
              Text('One platform.\nInfinite possibilities.', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF101D3A), height: 1.12, letterSpacing: -1.2)),
              const SizedBox(height: 12),
              const Text('Learning, skills, mentorship and career opportunities — all connected in one ecosystem.', style: TextStyle(fontSize: 12, height: 1.7, color: Color(0xFF536A88))),
              const SizedBox(height: 18),
              FilledButton(onPressed: _currentUser == null ? _openAccount : () => _showInfo(context, 'Welcome to SkillHeed', 'Your account is connected. Your personalized learning dashboard will be enabled as product modules are released.'), child: Text(_currentUser == null ? 'Get started' : 'Welcome, ${_currentUser?['fullName']?.toString().split(' ').first ?? 'Learner'}')),
            ]),
          ),
          const SizedBox(height: 22),

          if (_currentUser != null && ['STUDENT','TEACHER','INSTITUTION_ADMIN','PLATFORM_ADMIN','SUPER_ADMIN'].contains((_currentUser?['activeRole'] ?? _currentUser?['role']).toString()))
            Container(
              margin: const EdgeInsets.only(bottom: 22),
              padding: const EdgeInsets.all(17),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE7EDF6))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Your learning dashboard', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF101D3A))),
                    const SizedBox(height: 4),
                    Text((_currentUser?['activeRole'] ?? _currentUser?['role'] ?? 'STUDENT').toString(), style: const TextStyle(fontSize: 9, letterSpacing: .5, color: Color(0xFF71829C))),
                  ])),
                  IconButton(onPressed: _loadEducation, tooltip: 'Refresh classes and courses', icon: const Icon(Icons.refresh_rounded, color: Color(0xFF1769FF))),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: _summaryTile('Classes', _classes.length.toString(), Icons.school_outlined)),
                  const SizedBox(width: 8),
                  Expanded(child: _summaryTile('Courses', _courses.length.toString(), Icons.menu_book_outlined)),
                  const SizedBox(width: 8),
                  Expanded(child: _summaryTile('Attendance', _attendance.length.toString(), Icons.fact_check_outlined)),
                ]),
                if (_educationLoading) const Padding(padding: EdgeInsets.only(top: 14), child: LinearProgressIndicator(minHeight: 2)),
                if (_educationError.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_educationError, style: const TextStyle(fontSize: 10, color: Color(0xFFB42323)))),
                if (!_educationLoading && _educationError.isEmpty && _classes.isEmpty && _courses.isEmpty)
                  const Padding(padding: EdgeInsets.only(top: 14), child: Text('Your classes and courses will appear here when your institution enrolls you or publishes course content.', style: TextStyle(fontSize: 10, height: 1.7, color: Color(0xFF71829C)))),
                if (_classes.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('My classes', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF243652))),
                  const SizedBox(height: 5),
                  ..._classes.take(4).map((item) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.class_outlined, color: Color(0xFF1769FF)),
                    title: Text(item['name']?.toString() ?? 'Class', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    subtitle: Text('${item['organization'] is Map ? item['organization']['name'] : ''} · ${item['academicYear'] ?? ''}', style: const TextStyle(fontSize: 9, color: Color(0xFF71829C))),
                  )),
                ],
                if (_courses.isNotEmpty) ...[
                  const SizedBox(height: 7),
                  const Text('Available courses', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF243652))),
                  const SizedBox(height: 7),
                  ..._courses.take(5).map((course) => Card(
                    margin: const EdgeInsets.only(bottom: 7),
                    elevation: 0,
                    color: const Color(0xFFF8FAFF),
                    child: ListTile(
                      dense: true,
                      onTap: () => _openCourse(course),
                      leading: const Icon(Icons.menu_book_outlined, color: Color(0xFF1769FF)),
                      title: Text(course['title']?.toString() ?? 'Course', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                      subtitle: Text('${course['_count'] is Map ? course['_count']['lessons'] ?? 0 : 0} lessons · ${course['status'] ?? 'PUBLISHED'}', style: const TextStyle(fontSize: 9, color: Color(0xFF71829C))),
                      trailing: const Icon(Icons.chevron_right_rounded),
                    ),
                  )),
                ],
                if (_attendance.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  const Text('Recent attendance', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF243652))),
                  const SizedBox(height: 5),
                  ..._attendance.take(3).map((record) {
                    final rawDate = record['date']?.toString() ?? '';
                    final parsedDate = DateTime.tryParse(rawDate);
                    final classInfo = record['academicClass'];
                    final className = classInfo is Map ? classInfo['name']?.toString() ?? 'Class' : 'Class';
                    final status = record['status']?.toString() ?? '—';
                    final statusColor = status == 'PRESENT' ? const Color(0xFF087847) : status == 'ABSENT' ? const Color(0xFFB42323) : const Color(0xFF946200);
                    return Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
                      const Icon(Icons.event_available_outlined, size: 16, color: Color(0xFF71829C)),
                      const SizedBox(width: 8),
                      Expanded(child: Text('$className · ${parsedDate == null ? rawDate : parsedDate.toLocal().toString().split(' ').first}', style: const TextStyle(fontSize: 10, color: Color(0xFF53657F)))),
                      Text(status, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: statusColor)),
                    ]));
                  }),
                ],
              ]),
            ),
          Text('Explore SkillHeed', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF101D3A))),
          const SizedBox(height: 12),
          ...modules.map((m) => Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              contentPadding: const EdgeInsets.all(12),
              leading: Container(width: 47, height: 47, decoration: BoxDecoration(color: m.$4, borderRadius: BorderRadius.circular(14)), child: Icon(m.$3, color: const Color(0xFF1769FF))),
              title: Text(m.$1, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              subtitle: Padding(padding: const EdgeInsets.only(top: 5), child: Text(m.$2, style: const TextStyle(fontSize: 11, height: 1.5))),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 15),
              onTap: () => _showInfo(context, m.$1, 'This module UI and its protected API endpoints need to be implemented before enabling live actions.'),
            ),
          )),
          const SizedBox(height: 8),
          Row(children: [
            Icon(_apiState == 'API connected' ? Icons.check_circle : Icons.info_outline, size: 16, color: _apiState == 'API connected' ? Colors.green : Colors.blueGrey),
            const SizedBox(width: 8),
            Expanded(child: Text(_loadingProfile ? 'Restoring secure session…' : _apiState, style: const TextStyle(fontSize: 10, color: Color(0xFF687891)))),
          ]),
        ],
      )),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.bookmark_border), label: 'Saved'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
        onDestinationSelected: (index) {
          if (index == 3) { _openAccount(); return; }
          if (index != 0) _showInfo(context, ['Home','Explore','Saved','Profile'][index], 'This destination is a planned screen; implement the corresponding navigation and API workflow before release.');
        },
      ),
    );
  }
}
