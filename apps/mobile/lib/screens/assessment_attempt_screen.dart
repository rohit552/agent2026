import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';

class AssessmentAttemptScreen extends StatefulWidget {
  const AssessmentAttemptScreen({
    super.key,
    required this.auth,
    required this.assessment,
    required this.attempt,
    required this.initialAnswers,
  });

  final AuthService auth;
  final Map<String, dynamic> assessment;
  final Map<String, dynamic> attempt;
  final Map<String, dynamic> initialAnswers;

  @override
  State<AssessmentAttemptScreen> createState() => _AssessmentAttemptScreenState();
}

class _AssessmentAttemptScreenState extends State<AssessmentAttemptScreen> {
  final Map<String, dynamic> _answers = {};
  final Set<String> _savedQuestionIds = {};
  bool _saving = false;
  bool _submitting = false;
  String _error = '';
  String _notice = '';

  List<Map<String, dynamic>> get _questions {
    final raw = widget.assessment['questions'];
    if (raw is! List) return <Map<String, dynamic>>[];
    return raw.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  @override
  void initState() {
    super.initState();
    widget.initialAnswers.forEach((questionId, rawValue) {
      if (rawValue is Map && rawValue.containsKey('answer')) {
        _answers[questionId] = rawValue['answer'];
        _savedQuestionIds.add(questionId);
      } else {
        _answers[questionId] = rawValue;
      }
    });
  }

  void _setAnswer(String questionId, dynamic value) {
    setState(() {
      _answers[questionId] = value;
      _savedQuestionIds.remove(questionId);
      _notice = '';
      _error = '';
    });
  }

  Future<void> _saveQuestion(Map<String, dynamic> question) async {
    final questionId = question['id']?.toString() ?? '';
    if (questionId.isEmpty || !_answers.containsKey(questionId)) return;
    setState(() { _saving = true; _error = ''; _notice = ''; });
    try {
      await widget.auth.saveAssessmentAnswer(widget.attempt['id'].toString(), questionId, _answers[questionId]);
      if (!mounted) return;
      setState(() {
        _savedQuestionIds.add(questionId);
        _notice = 'Answer saved.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error is ApiException ? error.message : 'Could not save your answer.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting || _saving) return;
    setState(() { _submitting = true; _error = ''; _notice = ''; });
    try {
      for (final question in _questions) {
        final questionId = question['id']?.toString() ?? '';
        if (questionId.isNotEmpty && _answers.containsKey(questionId)) {
          await widget.auth.saveAssessmentAnswer(widget.attempt['id'].toString(), questionId, _answers[questionId]);
        }
      }
      final result = await widget.auth.submitAssessmentAttempt(widget.attempt['id'].toString());
      if (!mounted) return;
      final newAttempt = Map<String, dynamic>.from(result['attempt'] as Map);
      final manual = result['requiresManualGrading'] == true;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: Text(manual ? 'Assessment submitted' : 'Assessment scored'),
          content: Text(manual
              ? 'Your responses were submitted. Written answers are waiting for a teacher to review.'
              : 'Your answers were submitted and scored automatically.'),
          actions: [FilledButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Continue'))],
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop(newAttempt);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error is ApiException ? error.message : 'Could not submit the assessment.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _buildQuestion(Map<String, dynamic> question, int index) {
    final id = question['id']?.toString() ?? '';
    final type = question['questionType']?.toString() ?? 'SHORT_TEXT';
    final options = question['options'] is List
        ? (question['options'] as List).map((item) => Map<String, dynamic>.from(item as Map)).toList()
        : <Map<String, dynamic>>[];
    final current = _answers[id];

    return Container(
      margin: const EdgeInsets.only(bottom: 15),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE3EAF5)),
        borderRadius: BorderRadius.circular(17),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            height: 29, width: 29, alignment: Alignment.center,
            decoration: BoxDecoration(color: const Color(0xFFEAF3FF), borderRadius: BorderRadius.circular(9)),
            child: Text('${index + 1}', style: const TextStyle(color: Color(0xFF1769FF), fontWeight: FontWeight.w800, fontSize: 11)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(question['prompt']?.toString() ?? 'Question', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, height: 1.5, color: Color(0xFF17243D)))),
          Text('${question['points'] ?? 1} pt', style: const TextStyle(fontSize: 9, color: Color(0xFF71829C))),
        ]),
        if (question['required'] == true) const Padding(padding: EdgeInsets.only(top: 7), child: Text('Required', style: TextStyle(fontSize: 9, color: Color(0xFF1769FF), fontWeight: FontWeight.w700))),
        const SizedBox(height: 13),
        if (type == 'SINGLE_CHOICE')
          RadioGroup<String>(
            groupValue: current is String ? current : null,
            onChanged: (value) { if (!_submitting && value != null) _setAnswer(id, value); },
            child: Column(
              children: options.map((option) {
                final optionId = option['id']?.toString() ?? '';
                return RadioListTile<String>(
                  value: optionId,
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(option['text']?.toString() ?? optionId, style: const TextStyle(fontSize: 11)),
                  visualDensity: VisualDensity.compact,
                );
              }).toList(),
            ),
          ),
        if (type == 'MULTIPLE_CHOICE') ...options.map((option) {
          final optionId = option['id']?.toString() ?? '';
          final currentValues = current is List ? current.map((value) => value.toString()).toList() : <String>[];
          return CheckboxListTile(
            value: currentValues.contains(optionId),
            onChanged: _submitting ? null : (checked) {
              final next = [...currentValues];
              if (checked == true && !next.contains(optionId)) next.add(optionId);
              if (checked != true) next.remove(optionId);
              _setAnswer(id, next);
            },
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(option['text']?.toString() ?? optionId, style: const TextStyle(fontSize: 11)),
            controlAffinity: ListTileControlAffinity.leading,
            visualDensity: VisualDensity.compact,
          );
        }),
        if (type == 'TRUE_FALSE') Wrap(spacing: 10, children: [
          ChoiceChip(label: const Text('True'), selected: current == true || current == 'true', onSelected: _submitting ? null : (_) => _setAnswer(id, true)),
          ChoiceChip(label: const Text('False'), selected: current == false || current == 'false', onSelected: _submitting ? null : (_) => _setAnswer(id, false)),
        ]),
        if (type == 'SHORT_TEXT') TextFormField(
          initialValue: current?.toString() ?? '',
          onChanged: (value) => _setAnswer(id, value),
          minLines: 3,
          maxLines: 6,
          maxLength: 50000,
          enabled: !_submitting,
          decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Write your answer here'),
        ),
        const SizedBox(height: 9),
        Row(children: [
          Text(_savedQuestionIds.contains(id) ? 'Saved' : 'Not saved yet', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _savedQuestionIds.contains(id) ? const Color(0xFF087847) : const Color(0xFF8B97AA))),
          const Spacer(),
          OutlinedButton.icon(
            onPressed: _saving || _submitting || !_answers.containsKey(id) ? null : () => _saveQuestion(question),
            icon: const Icon(Icons.save_outlined, size: 15),
            label: const Text('Save answer'),
          ),
        ]),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final expiry = DateTime.tryParse(widget.attempt['expiresAt']?.toString() ?? '');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Assessment'),
        backgroundColor: const Color(0xFFF7FAFF),
      ),
      body: SafeArea(child: Column(children: [
        Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(18, 17, 18, 22), children: [
          Text(widget.assessment['title']?.toString() ?? 'Assessment', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -.6, color: Color(0xFF101D3A))),
          const SizedBox(height: 7),
          Text(widget.assessment['instructions']?.toString() ?? widget.assessment['description']?.toString() ?? '', style: const TextStyle(fontSize: 11, color: Color(0xFF687891), height: 1.7)),
          const SizedBox(height: 10),
          if (expiry != null) Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: const Color(0xFFFFF6E3), borderRadius: BorderRadius.circular(10)), child: Text('Time limit ends at ${expiry.toLocal()}. The server will enforce the deadline.', style: const TextStyle(fontSize: 10, color: Color(0xFF8B6314)))),
          const SizedBox(height: 17),
          ..._questions.asMap().entries.map((entry) => _buildQuestion(entry.value, entry.key)),
          if (_questions.isEmpty) const Padding(padding: EdgeInsets.all(20), child: Text('No questions were returned for this assessment.')),
          if (_error.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_error, style: const TextStyle(color: Color(0xFFB42323), fontSize: 11))),
          if (_notice.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_notice, style: const TextStyle(color: Color(0xFF087847), fontSize: 11))),
        ])),
        Container(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
          decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE7EDF6)))),
          child: Row(children: [
            Expanded(child: Text('${_questions.length} questions · Attempt ${widget.attempt['attemptNumber'] ?? 1}', style: const TextStyle(fontSize: 10, color: Color(0xFF687891)))),
            FilledButton(
              onPressed: _submitting || _saving || _questions.isEmpty ? null : _submit,
              child: _submitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Submit assessment'),
            ),
          ]),
        ),
      ])),
    );
  }
}
